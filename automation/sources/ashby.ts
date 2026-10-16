import { fetchJson } from '../http.ts'
import type { Company, RawPosting } from '../types.ts'

export type AshbyJob = {
  id: string
  title: string
  jobUrl: string
  location?: string
  secondaryLocations?: Array<{ location?: string }>
  isListed?: boolean
  isRemote?: boolean
  workplaceType?: string
  descriptionPlain?: string
  compensation?: { compensationTierSummary?: string | null }
}

const API = 'https://api.ashbyhq.com/posting-api/job-board'

// Ashby has no single-posting endpoint, so boards are cached for enrichment lookups.
const boardCache = new Map<string, Promise<AshbyJob[]>>()

export const fetchAshbyBoard = (board: string) => {
  let cached = boardCache.get(board)
  if (!cached) {
    cached = fetchJson<{ jobs: AshbyJob[] }>(`${API}/${board}?includeCompensation=true`).then((data) => data.jobs)
    boardCache.set(board, cached)
  }
  return cached
}

export const ashbyLocation = (job: AshbyJob) => (
  [job.location, ...(job.secondaryLocations ?? []).map((secondary) => secondary.location)]
    .filter((value): value is string => Boolean(value))
    .join('; ')
)

export const fetchAshby = async (company: Company): Promise<RawPosting[]> => {
  const jobs = await fetchAshbyBoard(company.board)
  return jobs
    .filter((job) => job.isListed !== false)
    .map((job) => ({
      source: `ashby:${company.board}`,
      company: company.name,
      title: job.title.trim(),
      url: job.jobUrl,
      location: ashbyLocation(job),
      description: job.descriptionPlain?.trim() || null,
      workplaceHint: job.workplaceType ?? (job.isRemote ? 'Remote' : null),
      salaryText: job.compensation?.compensationTierSummary ?? null,
      sponsorTier: company.sponsorTier,
      simplifySponsorship: null,
    }))
}
