import { fetchCookies, fetchJson } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// Eightfold career sites (Microsoft's apply.careers.microsoft.com). The site's own search JSON answers once the session
// cookies from its landing page are sent; without them it returns 403 or 429.

export type EightfoldPosition = { id: number; name: string; locations?: string[]; publicUrl?: string; workLocationOption?: string | null }
type EightfoldDetail = EightfoldPosition & { jobDescription?: string | null }

// The search returns 10 per page whatever is asked, half a Workday page, so it gets twice the pages.
const PAGE_SIZE = 10
const pagesPerTerm = (profile: Profile) => profile.workdayMaxPagesPerTerm * 2
// Same cap as the other keyword-search boards.
const MAX_DETAILS_PER_COMPANY = 40

export const eightfoldUrl = (host: string, position: EightfoldPosition) => position.publicUrl ?? `https://${host}/careers/job/${position.id}`

export const fetchEightfold = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const [host, domain] = company.board.split('/')
  const headers = { Cookie: await fetchCookies(`https://${host}/careers?domain=${encodeURIComponent(domain)}`), Referer: `https://${host}/careers` }
  const api = (path: string, params: Record<string, string>) => `https://${host}/api/pcsx/${path}?${new URLSearchParams({ domain, ...params })}`

  const listed = new Map<number, EightfoldPosition>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < pagesPerTerm(profile); page++) {
        const { data } = await fetchJson<{ data?: { positions?: EightfoldPosition[]; count?: number } }>(
          api('search', { query: searchText, location: 'United States', start: String(page * PAGE_SIZE) }), { headers },
        )
        const positions = data?.positions ?? []
        for (const position of positions) listed.set(position.id, position)
        if ((page + 1) * PAGE_SIZE >= (data?.count ?? 0) || positions.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  eightfold:${host} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for eightfold:${host}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((position) => ({ position, group: titleGroup(position.name, profile) }))
    .filter((entry): entry is { position: EightfoldPosition; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => Number(entryLevelTitle(b.position.name)) - Number(entryLevelTitle(a.position.name)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { position } of relevant) {
    let description: string | null = null
    try {
      const { data } = await fetchJson<{ data?: EightfoldDetail }>(api('position_details', { position_id: String(position.id), hl: 'en' }), { headers })
      description = data?.jobDescription ? htmlToText(data.jobDescription) : null
    } catch (error) {
      console.warn(`  eightfold:${host} detail failed for ${position.id}: ${String(error)}`)
    }
    postings.push({
      source: `eightfold:${host}`,
      company: company.name,
      title: position.name.trim(),
      url: eightfoldUrl(host, position),
      location: (position.locations ?? []).join('; '),
      description,
      workplaceHint: position.workLocationOption ?? null,
      salaryText: null,
      simplifySponsorship: null,
    })
  }
  return postings
}
