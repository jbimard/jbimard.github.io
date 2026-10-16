import { mapWithConcurrency } from '../http.ts'
import type { RawPosting } from '../types.ts'
import { fetchAshbyBoard } from './ashby.ts'
import { fetchGreenhouseJob } from './greenhouse.ts'
import { fetchLeverPosting, leverDescription } from './lever.ts'
import { fetchWorkdayDetail } from './workday.ts'

type Enrichment = { description: string | null; salaryText?: string | null; workplaceHint?: string | null }

// Works out which job board a posting URL belongs to and pulls the full description from it.
const enrichFromUrl = async (rawUrl: string): Promise<Enrichment | null> => {
  const url = new URL(rawUrl)
  const segments = url.pathname.split('/').filter(Boolean)

  if (/(^|\.)greenhouse\.io$/.test(url.hostname)) {
    const board = url.searchParams.get('for') ?? segments[0]
    const id = url.searchParams.get('token') ?? segments[segments.indexOf('jobs') + 1]
    if (!board || !id) return null
    return { description: await fetchGreenhouseJob(board, id) }
  }

  if (url.hostname === 'jobs.lever.co' && segments.length >= 2) {
    const posting = await fetchLeverPosting(segments[0], segments[1])
    return { description: leverDescription(posting), workplaceHint: posting.workplaceType ?? null }
  }

  if (url.hostname === 'jobs.ashbyhq.com' && segments.length >= 2) {
    const job = (await fetchAshbyBoard(segments[0])).find((candidate) => candidate.id === segments[1])
    if (!job) return null
    return {
      description: job.descriptionPlain?.trim() || null,
      salaryText: job.compensation?.compensationTierSummary ?? null,
      workplaceHint: job.workplaceType ?? null,
    }
  }

  // {tenant}.wdN.myworkdayjobs.com/[locale/]{site}/job/...  or  wdN.myworkdaysite.com/recruiting/{tenant}/{site}/job/...
  const jobIndex = segments.indexOf('job')
  if (jobIndex > 0 && url.hostname.endsWith('.myworkdayjobs.com')) {
    const tenant = url.hostname.split('.')[0]
    const site = segments[jobIndex - 1]
    const detail = await fetchWorkdayDetail(`https://${url.hostname}/wday/cxs/${tenant}/${site}`, `/${segments.slice(jobIndex).join('/')}`)
    return { description: detail.description }
  }
  if (jobIndex > 2 && url.hostname.endsWith('.myworkdaysite.com') && segments[0] === 'recruiting') {
    const [, tenant, site] = segments
    const detail = await fetchWorkdayDetail(`https://${url.hostname}/wday/cxs/${tenant}/${site}`, `/${segments.slice(jobIndex).join('/')}`)
    return { description: detail.description }
  }

  return null
}

const SUPPORTED_HOST = /(^|\.)greenhouse\.io$|^jobs\.lever\.co$|^jobs\.ashbyhq\.com$|\.myworkdayjobs\.com$|\.myworkdaysite\.com$/
const PARALLEL_LOOKUPS = 8

const isSupported = (rawUrl: string) => {
  try {
    return SUPPORTED_HOST.test(new URL(rawUrl).hostname)
  } catch {
    return false
  }
}

// skipped = unsupported job board or over the lookup budget.
export type EnrichStats = { attempted: number; enriched: number; skipped: number; failed: number }

// Fills in descriptions for postings that arrived without one (Simplify), up to `limit` lookups.
export const enrichPostings = async (postings: RawPosting[], limit: number): Promise<EnrichStats> => {
  const missing = postings.filter((posting) => posting.description === null)
  const targets = missing.filter((posting) => isSupported(posting.url)).slice(0, limit)
  const stats: EnrichStats = { attempted: targets.length, enriched: 0, skipped: missing.length - targets.length, failed: 0 }

  await mapWithConcurrency(targets, PARALLEL_LOOKUPS, async (posting) => {
    try {
      const enrichment = await enrichFromUrl(posting.url)
      if (!enrichment) return
      posting.description = enrichment.description
      posting.salaryText = enrichment.salaryText ?? posting.salaryText
      posting.workplaceHint = enrichment.workplaceHint ?? posting.workplaceHint
      if (enrichment.description) stats.enriched++
    } catch {
      stats.failed++
    }
  })
  return stats
}
