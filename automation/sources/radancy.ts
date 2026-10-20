import { fetchJson, fetchText } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { decodeEntities, locationTier } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'
import { parseJobPostingLd } from './jsonld.ts'

// Radancy (TalentBrew) career sites, e.g. jobs.spectrum.com for Charter. The site's search answers with its results
// list as HTML inside JSON; each posting page carries a schema.org JobPosting block for the description.

export type RadancyListItem = { id: string; title: string; url: string; location: string }

const PAGE_SIZE = 50
// Same cap as the other keyword-search boards.
const MAX_DETAILS_PER_COMPANY = 40

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

export const parseRadancyResults = (html: string, host: string): { items: RadancyListItem[]; total: number } => {
  const items = [...html.matchAll(/<a href="(\/job\/[^"]+)" data-job-id="(\d+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, path, id, body]) => ({
    id,
    title: text(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''),
    url: `https://${host}${decodeEntities(path)}`,
    location: text(/<span class="job-location">([\s\S]*?)<\/span>/.exec(body)?.[1] ?? ''),
  })).filter((item) => item.title)
  const total = Number(/data-total-results="(\d+)"/.exec(html)?.[1] ?? items.length)
  return { items, total }
}

const searchUrl = (host: string, keywords: string, page: number) => `https://${host}/search-jobs/results?${new URLSearchParams({
  ActiveFacetID: '0', CurrentPage: String(page), RecordsPerPage: String(PAGE_SIZE), Distance: '50', RadiusUnitType: '0',
  Keywords: keywords, Location: '', ShowRadius: 'False', IsPagination: page > 1 ? 'True' : 'False', FacetType: '0',
  SearchResultsModuleName: 'Search Results', SearchFiltersModuleName: 'Search Filters', SortCriteria: '0', SortDirection: '0',
  SearchType: '5', ResultsType: '0',
})}`

export const fetchRadancy = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const host = company.board
  const listed = new Map<string, RadancyListItem>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 1; page <= profile.workdayMaxPagesPerTerm; page++) {
        const { results = '' } = await fetchJson<{ results?: string }>(searchUrl(host, searchText, page), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        const { items, total } = parseRadancyResults(results, host)
        for (const item of items) listed.set(item.id, item)
        if (page * PAGE_SIZE >= total || items.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  radancy:${host} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for radancy:${host}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((item) => ({ item, group: titleGroup(item.title, profile) }))
    .filter((entry): entry is { item: RadancyListItem; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => locationTier(b.item.location, profile) - locationTier(a.item.location, profile)
      || Number(entryLevelTitle(b.item.title)) - Number(entryLevelTitle(a.item.title)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { item } of relevant) {
    let description: string | null = null
    try {
      description = parseJobPostingLd(await fetchText(item.url))?.description ?? null
    } catch (error) {
      console.warn(`  radancy:${host} detail failed for ${item.url}: ${String(error)}`)
    }
    postings.push({
      source: `radancy:${host}`,
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
