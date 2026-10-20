import { fetchJson, postJson } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { htmlToText, locationTier, scoreLocation } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// Some boards (IQVIA, Accenture) list items without a title; those are skipped.
type WorkdayListItem = { title?: string; externalPath: string; locationsText?: string }
// A facet group in a search response; location groups nest their values one level down.
type WorkdayFacetValue = { descriptor?: string; id?: string; facetParameter?: string; values?: WorkdayFacetValue[] }
type WorkdayFacet = WorkdayFacetValue & { values?: WorkdayFacetValue[] }
type WorkdayDetail = {
  jobPostingInfo: {
    title: string
    jobDescription?: string
    location?: string
    additionalLocations?: string[]
    externalUrl?: string
    timeType?: string
    country?: { descriptor?: string }
  }
}

const PAGE_SIZE = 20
// Detail calls are the expensive part; listings with a US location go first (global boards like Accenture and
// PwC otherwise spend the budget abroad), then early-career and intern titles, then group A, B, C.
const MAX_DETAILS_PER_COMPANY = 40

export type WorkdayDetailResult = { title: string; description: string | null; location: string; url: string | null }

// Shared with enrichment: `apiBase` is "https://{host}/wday/cxs/{tenant}/{site}", `jobPath` starts with "/job/".
export const fetchWorkdayDetail = async (apiBase: string, jobPath: string): Promise<WorkdayDetailResult> => {
  const { jobPostingInfo: info } = await fetchJson<WorkdayDetail>(`${apiBase}${jobPath}`)
  const country = info.country?.descriptor
  const locations = [
    [info.location, country].filter(Boolean).join(', '),
    ...(info.additionalLocations ?? []),
  ].filter(Boolean)
  return {
    title: info.title.trim(),
    description: info.jobDescription ? htmlToText(info.jobDescription) : null,
    location: locations.join('; '),
    url: info.externalUrl ?? null,
  }
}

// Workday labels the same place many ways: "US - North Carolina - Durham", "Durham, North Carolina, USA", "Durham, NC".
// Try the label as written, then as "City, NC" and "City, North Carolina", so the profile's metro phrases match either.
const facetLocationCandidates = (descriptor: string) => {
  const parts = descriptor.split(/\s+-\s+|,\s*/).map((part) => part.trim()).filter(Boolean)
  const inNorthCarolina = parts.some((part) => /^(north carolina|nc)$/i.test(part))
  const city = parts.filter((part) => !/^(us|usa|u\.s\.a?\.?|united states( of america)?|north carolina|nc)$/i.test(part)).at(-1)
  return inNorthCarolina && city ? [descriptor, `${city}, NC`, `${city}, North Carolina`] : [descriptor]
}

// Ids of the board's location filters that fall in the profile's metros (or are remote US), as { facet parameter: ids }.
// null when the board exposes no usable location filter; {} when it has one but nothing matches.
export const metroFacets = (facets: WorkdayFacet[], profile: Profile): Record<string, string[]> | null => {
  const found: Record<string, string[]> = {}
  let sawLocationFilter = false
  const visit = (value: WorkdayFacetValue, parameter: string | undefined) => {
    const param = value.facetParameter ?? parameter
    if (value.id && value.descriptor && param && /^locations?$|^locationHierarchy/i.test(param)) {
      sawLocationFilter = true
      if (facetLocationCandidates(value.descriptor).some((label) => scoreLocation(label, profile).points !== null)) {
        ;(found[param] ??= []).push(value.id)
      }
    }
    for (const child of value.values ?? []) visit(child, param)
  }
  for (const facet of facets) visit(facet, undefined)
  return sawLocationFilter ? found : null
}

export const fetchWorkday = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const [tenant, pod, site] = company.board.split('/')
  const host = `${tenant}.${pod}.myworkdayjobs.com`
  const apiBase = `https://${host}/wday/cxs/${tenant}/${site}`

  // Metro-only profiles: ask the board for just its Triangle (or remote) postings, so national employers' other
  // sites can't fill the per-company budget. Boards with no location filter fall back to ranking by location below.
  let appliedFacets = company.workdayFacets ?? {}
  if (profile.metroOnly) {
    try {
      const { facets = [] } = await postJson<{ facets?: WorkdayFacet[] }>(`${apiBase}/jobs`, { appliedFacets, limit: 1, offset: 0, searchText: '' })
      const metro = metroFacets(facets, profile)
      if (metro && Object.keys(metro).length === 0) return []
      if (metro) appliedFacets = { ...appliedFacets, ...metro }
    } catch (error) {
      console.warn(`  workday:${tenant} location filters unavailable: ${String(error)}`)
    }
  }

  const listed = new Map<string, WorkdayListItem>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < profile.workdayMaxPagesPerTerm; page++) {
        const { jobPostings = [], total = 0 } = await postJson<{ jobPostings?: WorkdayListItem[]; total?: number }>(
          `${apiBase}/jobs`,
          { appliedFacets, limit: PAGE_SIZE, offset: page * PAGE_SIZE, searchText },
        )
        for (const item of jobPostings) listed.set(item.externalPath, item)
        if ((page + 1) * PAGE_SIZE >= total || jobPostings.length === 0) break
      }
    } catch (error) {
      // One flaky search shouldn't lose the company's other results.
      failedTerms++
      console.warn(`  workday:${tenant} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for workday:${tenant}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .filter((item): item is WorkdayListItem & { title: string } => typeof item.title === 'string')
    .map((item) => ({ item, group: titleGroup(item.title, profile) }))
    .filter((entry): entry is { item: WorkdayListItem & { title: string }; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .map((entry) => ({ ...entry, us: scoreLocation(entry.item.locationsText ?? '', profile).points !== null }))
    .sort((a, b) => locationTier(b.item.locationsText, profile) - locationTier(a.item.locationsText, profile)
      || Number(b.us) - Number(a.us)
      || Number(entryLevelTitle(b.item.title)) - Number(entryLevelTitle(a.item.title))
      || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { item } of relevant) {
    try {
      const detail = await fetchWorkdayDetail(apiBase, item.externalPath)
      postings.push({
        source: `workday:${tenant}`,
        company: company.name,
        title: detail.title,
        url: detail.url ?? `https://${host}/${site}${item.externalPath}`,
        location: detail.location || item.locationsText || '',
        description: detail.description,
        workplaceHint: null,
        salaryText: null,
        simplifySponsorship: null,
      })
    } catch (error) {
      console.warn(`  workday:${tenant} detail failed for ${item.externalPath}: ${String(error)}`)
    }
  }
  return postings
}
