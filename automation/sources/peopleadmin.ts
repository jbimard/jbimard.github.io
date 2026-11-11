import { fetchText } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { decodeEntities, htmlToText } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// PeopleAdmin (NC State at jobs.ncsu.edu, UNC-Chapel Hill at unc.peopleadmin.com). No public JSON API, so this reads the
// search result pages (30 per page, `?query=&page=`) and each posting page's field table. Search is full text, so titles
// are filtered before any posting page is fetched.

export type PeopleAdminListItem = { id: string; title: string; url: string }

const PAGE_SIZE = 30
// Same cap as Workday, iCIMS and SuccessFactors.
const MAX_DETAILS_PER_COMPANY = 40

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// One results page: its rows and the total result count ("View Results (414)").
export const parsePeopleAdminSearch = (html: string, host: string): { items: PeopleAdminListItem[]; total: number } => {
  const items = html.split('job-item-posting').slice(1).flatMap((row): PeopleAdminListItem[] => {
    const link = /<h3>\s*<a [^>]*href="\/postings\/(\d+)"[^>]*>([\s\S]*?)<\/a>/.exec(row)
    if (!link) return []
    const [, id, title] = link
    return [{ id, title: text(title), url: `https://${host}/postings/${id}` }]
  })
  const total = Number(/smaller muted'>\s*\((\d+)/.exec(html)?.[1] ?? items.length)
  return { items, total }
}

const LOCATION_LABELS = ['job location', 'work location', 'position location']

// The posting page: location from its field table, and the page text (which includes the notice to applicants).
export const parsePeopleAdminJob = (html: string): { location: string; description: string | null } => {
  let location = ''
  for (const [, label, value] of html.matchAll(/<th>([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    if (!location && LOCATION_LABELS.includes(text(label).toLowerCase())) location = text(value)
  }
  const main = html.indexOf('<main')
  return { location, description: htmlToText(main > 0 ? html.slice(main) : html) || null }
}

export const fetchPeopleAdmin = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const host = company.board
  const terms = [...profile.workdaySearchTerms, ...(company.extraTerms ?? [])]
  const listed = new Map<string, PeopleAdminListItem>()
  let failedTerms = 0
  for (const searchText of terms) {
    try {
      for (let page = 1; page <= profile.workdayMaxPagesPerTerm; page++) {
        const url = `https://${host}/postings/search?query=${encodeURIComponent(searchText)}&page=${page}`
        const { items, total } = parsePeopleAdminSearch(await fetchText(url), host)
        for (const item of items) listed.set(item.id, item)
        if (page * PAGE_SIZE >= total || items.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  peopleadmin:${host} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === terms.length) throw new Error(`every search failed for peopleadmin:${host}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((item) => ({ item, group: titleGroup(item.title, profile) }))
    .filter((entry): entry is { item: PeopleAdminListItem; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => Number(entryLevelTitle(b.item.title)) - Number(entryLevelTitle(a.item.title)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { item } of relevant) {
    let detail: { location: string; description: string | null } = { location: '', description: null }
    try {
      detail = parsePeopleAdminJob(await fetchText(item.url))
    } catch (error) {
      console.warn(`  peopleadmin:${host} detail failed for ${item.url}: ${String(error)}`)
    }
    postings.push({
      source: `peopleadmin:${host}`,
      company: company.name,
      title: item.title,
      url: item.url,
      location: detail.location,
      description: detail.description,
      workplaceHint: null,
      salaryText: null,
      simplifySponsorship: null,
    })
  }
  return postings
}
