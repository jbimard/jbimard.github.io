import { fetchJson } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// Oracle Recruiting Cloud "Candidate Experience" sites (Honeywell). The career site's own JSON search, no key needed:
// keyword search lists requisitions, and a detail call returns the posting text.

export type OracleRequisition = {
  Id: string
  Title: string
  PrimaryLocation?: string
  secondaryLocations?: Array<{ Name?: string }>
  WorkplaceType?: string | null
}
type OracleDetail = {
  ExternalDescriptionStr?: string | null
  ExternalResponsibilitiesStr?: string | null
  ExternalQualificationsStr?: string | null
}

const PAGE_SIZE = 100
// Same cap as the other keyword-search boards.
const MAX_DETAILS_PER_COMPANY = 40

const api = (host: string) => `https://${host}/hcmRestApi/resources/latest`

export const oracleUrl = (host: string, site: string, id: string) => `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${id}`

export const oracleLocation = (req: OracleRequisition) => (
  [req.PrimaryLocation, ...(req.secondaryLocations ?? []).map((location) => location.Name)].filter(Boolean).join('; ')
)

export const oracleDescription = (detail: OracleDetail) => (
  [detail.ExternalDescriptionStr, detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr]
    .filter((part): part is string => Boolean(part?.trim()))
    .map(htmlToText)
    .join('\n')
    .trim() || null
)

export const fetchOracle = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  // board: "{host}/{siteNumber}", e.g. "ibqbjb.fa.ocs.oraclecloud.com/CX_1".
  const [host, site] = company.board.split('/')
  const listed = new Map<string, OracleRequisition>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < profile.workdayMaxPagesPerTerm; page++) {
        const finder = `findReqs;siteNumber=${site},keyword=${encodeURIComponent(searchText)},limit=${PAGE_SIZE},offset=${page * PAGE_SIZE}`
        const { items = [] } = await fetchJson<{ items?: Array<{ TotalJobsCount?: number; requisitionList?: OracleRequisition[] }> }>(
          `${api(host)}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=${finder}`,
        )
        const { TotalJobsCount: total = 0, requisitionList = [] } = items[0] ?? {}
        for (const req of requisitionList) listed.set(req.Id, req)
        if ((page + 1) * PAGE_SIZE >= total || requisitionList.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  oracle:${host} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for oracle:${host}`)

  const rank = { A: 0, B: 1, C: 2 }
  const relevant = [...listed.values()]
    .map((req) => ({ req, group: titleGroup(req.Title, profile) }))
    .filter((entry): entry is { req: OracleRequisition; group: 'A' | 'B' | 'C' } => entry.group !== null)
    .sort((a, b) => Number(entryLevelTitle(b.req.Title)) - Number(entryLevelTitle(a.req.Title)) || rank[a.group] - rank[b.group])
    .slice(0, MAX_DETAILS_PER_COMPANY)

  const postings: RawPosting[] = []
  for (const { req } of relevant) {
    let description: string | null = null
    try {
      const { items = [] } = await fetchJson<{ items?: OracleDetail[] }>(
        `${api(host)}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(req.Id)}%22,siteNumber=${site}`,
      )
      description = items[0] ? oracleDescription(items[0]) : null
    } catch (error) {
      console.warn(`  oracle:${host} detail failed for ${req.Id}: ${String(error)}`)
    }
    postings.push({
      source: `oracle:${host}`,
      company: company.name,
      title: req.Title.trim(),
      url: oracleUrl(host, site, req.Id),
      location: oracleLocation(req),
      description,
      workplaceHint: req.WorkplaceType ?? null,
      salaryText: null,
      simplifySponsorship: null,
    })
  }
  return postings
}
