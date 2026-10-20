import { fetchText } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { decodeEntities, locationTier } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'
import { parseJobPostingLd, type JobPostingLdResult } from './jsonld.ts'

// iCIMS career sites have no public JSON API, so this reads the same HTML pages a browser does ("in_iframe=1" is the
// bare version without the company's site around it). Each posting page carries a schema.org JobPosting, which is
// what Google for Jobs reads, so the description comes from there instead of the page layout.

export type IcimsListItem = { id: string; title: string; url: string; location: string }

// Same cap as Workday: detail pages are the expensive part, group A titles go first.
const MAX_DETAILS_PER_COMPANY = 40

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// One search results page: its job cards and the total page count ("Page 1 of 4").
export const parseIcimsSearch = (html: string): { items: IcimsListItem[]; pages: number } => {
  const items = html.split('class="iCIMS_JobCardItem"').slice(1).flatMap((card): IcimsListItem[] => {
    const link = /<a href="([^"]*\/jobs\/(\d+)\/[^"]*)"/.exec(card)
    const title = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(card)
    if (!link || !title) return []
    const fields = new Map([...card.matchAll(/<dt class="iCIMS_JobHeaderField">([\s\S]*?)<\/dt>\s*<dd class="iCIMS_JobHeaderData">([\s\S]*?)<\/dd>/g)]
      .map(([, label, value]) => [text(label), text(value)] as const))
    const field = (prefix: string) => [...fields].find(([label]) => label.startsWith(prefix))?.[1]
    const state = [...fields].find(([label]) => label.includes('State/Province'))?.[1]
    const location = [field('City'), state, field('Country')].filter(Boolean).join(', ')
    // Drop the iframe parameters so the stored link opens the normal page.
    const url = decodeEntities(link[1]).replace(/\?.*$/, '')
    return [{ id: link[2], title: text(title[1]), url, location }]
  })
  const pages = Number(/Page\s*\d+\s*of\s*(\d+)/.exec(html)?.[1] ?? 1)
  return { items, pages }
}

export const fetchIcims = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const host = `https://${company.board}.icims.com`
  const listed = new Map<string, IcimsListItem>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < profile.workdayMaxPagesPerTerm; page++) {
        const { items, pages } = parseIcimsSearch(await fetchText(`${host}/jobs/search?ss=1&searchKeyword=${encodeURIComponent(searchText)}&in_iframe=1&pr=${page}`))
        for (const item of items) listed.set(item.id, item)
        if (page + 1 >= pages || items.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  icims:${company.board} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for icims:${company.board}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((item) => ({ item, group: titleGroup(item.title, profile) }))
    .filter((entry): entry is { item: IcimsListItem; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => locationTier(b.item.location, profile) - locationTier(a.item.location, profile)
      || Number(entryLevelTitle(b.item.title)) - Number(entryLevelTitle(a.item.title)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { item } of relevant) {
    let job: JobPostingLdResult | null = null
    try {
      job = parseJobPostingLd(await fetchText(`${item.url}?in_iframe=1`))
    } catch (error) {
      console.warn(`  icims:${company.board} detail failed for ${item.url}: ${String(error)}`)
    }
    postings.push({
      source: `icims:${company.board}`,
      company: company.name,
      title: job?.title ?? item.title,
      url: item.url,
      // The card's "Cary HQ, North Carolina, United States" reads better than the structured address.
      location: item.location || job?.location || '',
      description: job?.description ?? null,
      workplaceHint: null,
      salaryText: null,
      simplifySponsorship: null,
    })
  }
  return postings
}
