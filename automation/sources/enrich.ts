import { mapWithConcurrency } from '../http.ts'
import { parseBoardUrl } from '../links/boards.ts'
import type { RawPosting } from '../types.ts'
import { fetchAshbyBoard } from './ashby.ts'
import { fetchGreenhouseJob } from './greenhouse.ts'
import { fetchLeverPosting, leverDescription } from './lever.ts'
import { fetchWorkdayDetail } from './workday.ts'

type Enrichment = { description: string | null; salaryText?: string | null; workplaceHint?: string | null }

// Pulls the full description from the job board the posting URL belongs to.
const enrichFromUrl = async (rawUrl: string): Promise<Enrichment | null> => {
  const ref = parseBoardUrl(rawUrl)
  switch (ref?.kind) {
    case 'greenhouse':
      return { description: await fetchGreenhouseJob(ref.board, ref.id) }
    case 'lever': {
      const posting = await fetchLeverPosting(ref.site, ref.id)
      return { description: leverDescription(posting), workplaceHint: posting.workplaceType ?? null }
    }
    case 'ashby': {
      const job = (await fetchAshbyBoard(ref.board)).find((candidate) => candidate.id === ref.id)
      if (!job) return null
      return {
        description: job.descriptionPlain?.trim() || null,
        salaryText: job.compensation?.compensationTierSummary ?? null,
        workplaceHint: job.workplaceType ?? null,
      }
    }
    case 'workday':
      return { description: (await fetchWorkdayDetail(ref.apiBase, ref.jobPath)).description }
    default:
      return null
  }
}

const PARALLEL_LOOKUPS = 8

// skipped = unsupported job board or over the lookup budget.
export type EnrichStats = { attempted: number; enriched: number; skipped: number; failed: number }

// Fills in descriptions for postings that arrived without one (Simplify), up to `limit` lookups.
export const enrichPostings = async (postings: RawPosting[], limit: number): Promise<EnrichStats> => {
  const missing = postings.filter((posting) => posting.description === null)
  const targets = missing.filter((posting) => parseBoardUrl(posting.url) !== null).slice(0, limit)
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
