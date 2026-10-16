import { fetchJson } from '../http.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, RawPosting } from '../types.ts'

export type GreenhouseJob = {
  id: number
  title: string
  absolute_url: string
  location?: { name?: string }
  offices?: Array<{ name?: string; location?: string | null }>
  content?: string
}

const API = 'https://boards-api.greenhouse.io/v1/boards'

export const greenhouseLocation = (job: GreenhouseJob) => (
  [job.location?.name, ...(job.offices ?? []).map((office) => office.location ?? office.name)]
    .filter((value): value is string => Boolean(value))
    .join('; ')
)

export const fetchGreenhouseJob = async (board: string, id: string) => {
  const job = await fetchJson<GreenhouseJob>(`${API}/${board}/jobs/${id}`)
  return job.content ? htmlToText(job.content) : null
}

export const fetchGreenhouse = async (company: Company): Promise<RawPosting[]> => {
  const { jobs } = await fetchJson<{ jobs: GreenhouseJob[] }>(`${API}/${company.board}/jobs?content=true`)
  return jobs.map((job) => ({
    source: `greenhouse:${company.board}`,
    company: company.name,
    title: job.title.trim(),
    url: job.absolute_url,
    location: greenhouseLocation(job),
    description: job.content ? htmlToText(job.content) : null,
    workplaceHint: null,
    salaryText: null,
    sponsorTier: company.sponsorTier,
    simplifySponsorship: null,
  }))
}
