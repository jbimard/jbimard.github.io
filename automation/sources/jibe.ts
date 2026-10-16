import { fetchJson } from '../http.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, Profile, RawPosting } from '../types.ts'

// Jibe (Google's career-site product; the posting still lives in iCIMS behind it) answers keyword searches with full
// postings, descriptions included, so there is no detail call.

export type JibeJob = {
  slug: string
  title: string
  description?: string
  full_location?: string
  short_location?: string
  employment_type?: string
}

const PAGE_SIZE = 100

export const jibeUrl = (board: string, slug: string) => `https://${board}.jibeapply.com/jobs/${slug}`

export const jibePosting = (company: Company, job: JibeJob): RawPosting => ({
  source: `jibe:${company.board}`,
  company: company.name,
  title: job.title.trim(),
  url: jibeUrl(company.board, job.slug),
  location: job.full_location || job.short_location || '',
  description: job.description ? htmlToText(job.description) : null,
  workplaceHint: null,
  salaryText: null,
  simplifySponsorship: null,
})

export const fetchJibe = async (company: Company, profile: Profile): Promise<RawPosting[]> => {
  const api = `https://${company.board}.jibeapply.com/api/jobs`
  const listed = new Map<string, JibeJob>()
  let failedTerms = 0
  for (const searchText of profile.workdaySearchTerms) {
    try {
      for (let page = 1; page <= profile.workdayMaxPagesPerTerm; page++) {
        const { jobs = [], totalCount = 0 } = await fetchJson<{ jobs?: Array<{ data: JibeJob }>; totalCount?: number }>(
          `${api}?page=${page}&limit=${PAGE_SIZE}&keywords=${encodeURIComponent(searchText)}`,
        )
        for (const { data } of jobs) listed.set(data.slug, data)
        if (page * PAGE_SIZE >= totalCount || jobs.length === 0) break
      }
    } catch (error) {
      failedTerms++
      console.warn(`  jibe:${company.board} search "${searchText}" failed: ${String(error)}`)
    }
  }
  if (failedTerms === profile.workdaySearchTerms.length) throw new Error(`every search failed for jibe:${company.board}`)
  return [...listed.values()].map((job) => jibePosting(company, job))
}
