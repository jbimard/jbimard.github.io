import { fetchText } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { decodeEntities, htmlToText, locationTier } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// SAP SuccessFactors Career Site Builder (careers.duke.edu, careers.novonordisk.com). No public JSON API, so this reads
// the search results table and each posting page. Search matches full text, so most results are off-target; titles are
// filtered before any posting page is fetched.

export type SuccessFactorsListItem = { id: string; title: string; url: string; location: string }

const PAGE_SIZE = 25
// Same cap as Workday and iCIMS.
const MAX_DETAILS_PER_COMPANY = 40

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// One results page: its rows and the total result count ("Results 1 – 25 of 1105").
export const parseSuccessFactorsSearch = (html: string, host: string): { items: SuccessFactorsListItem[]; total: number } => {
  const items = html.split('class="data-row').slice(1).flatMap((row): SuccessFactorsListItem[] => {
    const link = /<a [^>]*href="(\/job\/[^"]*\/(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/.exec(row)
    if (!link) return []
    const [, path, id, title] = link
    const location = /<span class="jobLocation">([\s\S]*?)<\/span>/.exec(row)?.[1]
    return [{ id, title: text(title), url: `https://${host}${decodeEntities(path)}`, location: location ? text(location) : '' }]
  })
  const total = Number(/Results\s*<b>[^<]*<\/b>\s*of\s*<b>([\d,]+)<\/b>/.exec(html)?.[1].replace(/,/g, '') ?? items.length)
  return { items, total }
}

// The posting text: the `jobdescription` span, closed by counting nested spans. null when the page has none.
export const parseSuccessFactorsJob = (html: string): string | null => {
  const start = html.indexOf('<span class="jobdescription">')
  if (start < 0) return null
  let depth = 0
  for (const match of html.slice(start).matchAll(/<(\/?)span\b[^>]*>/g)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return htmlToText(html.slice(start, start + match.index + match[0].length)) || null
  }
  return null
}

export const fetchSuccessFactors = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const host = company.board
  const listed = new Map<string, SuccessFactorsListItem>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < profile.workdayMaxPagesPerTerm; page++) {
        const url = `https://${host}/search/?q=${encodeURIComponent(searchText)}&sortColumn=referencedate&sortDirection=desc&startrow=${page * PAGE_SIZE}`
        const { items, total } = parseSuccessFactorsSearch(await fetchText(url), host)
        for (const item of items) listed.set(item.id, item)
        if ((page + 1) * PAGE_SIZE >= total || items.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  successfactors:${host} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for successfactors:${host}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((item) => ({ item, group: titleGroup(item.title, profile) }))
    .filter((entry): entry is { item: SuccessFactorsListItem; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => locationTier(b.item.location, profile) - locationTier(a.item.location, profile)
      || Number(entryLevelTitle(b.item.title)) - Number(entryLevelTitle(a.item.title)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { item } of relevant) {
    let description: string | null = null
    try {
      description = parseSuccessFactorsJob(await fetchText(item.url))
    } catch (error) {
      console.warn(`  successfactors:${host} detail failed for ${item.url}: ${String(error)}`)
    }
    postings.push({
      source: `successfactors:${host}`,
      company: company.name,
      title: item.title,
      url: item.url,
      location: item.location,
      description,
      workplaceHint: null,
      salaryText: null,
      simplifySponsorship: null,
    })
  }
  return postings
}
