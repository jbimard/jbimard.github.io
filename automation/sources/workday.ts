import { fetchJson, postJson } from '../http.ts'
import { entryLevelTitle } from '../rules/flags.ts'
import { titleGroup } from '../rules/score.ts'
import { htmlToText, scoreLocation } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// Some boards (IQVIA, Accenture) list items without a title; those are skipped.
type WorkdayListItem = { title?: string; externalPath: string; locationsText?: string }
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

export const fetchWorkday = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const [tenant, pod, site] = company.board.split('/')
  const host = `${tenant}.${pod}.myworkdayjobs.com`
  const apiBase = `https://${host}/wday/cxs/${tenant}/${site}`

  const listed = new Map<string, WorkdayListItem>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 0; page < profile.workdayMaxPagesPerTerm; page++) {
        const { jobPostings = [], total = 0 } = await postJson<{ jobPostings?: WorkdayListItem[]; total?: number }>(
          `${apiBase}/jobs`,
          { appliedFacets: company.workdayFacets ?? {}, limit: PAGE_SIZE, offset: page * PAGE_SIZE, searchText },
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
    .sort((a, b) => Number(b.us) - Number(a.us)
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
