// Daily job discovery: fetch postings → filter/score → send to the job-intake Edge Function.
// Usage: node automation/discover.ts [--dry-run] [--limit=N]
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mapWithConcurrency, postJson } from './http.ts'
import { evaluatePosting, type Breakdown } from './rules/score.ts'
import { fromSponsorFile, indexSponsors, lookupSponsor, type SponsorFile, type SponsorRecord } from './rules/sponsors.ts'
import { scoreLocation, shortLocation } from './rules/text.ts'
import { fetchAshby } from './sources/ashby.ts'
import { enrichPostings } from './sources/enrich.ts'
import { fetchGreenhouse } from './sources/greenhouse.ts'
import { fetchLever } from './sources/lever.ts'
import { fetchSimplify, stripTracking } from './sources/simplify.ts'
import { fetchWorkday } from './sources/workday.ts'
import type { Company, IntakeJob, Profile, RawPosting, SponsorTier } from './types.ts'

const ROOT = import.meta.dirname
const OUT_DIR = path.join(ROOT, 'out')
const BATCH_SIZE = 50
const TOP_PRINTED = 25
// Different boards are fetched in parallel; each board still gets one request at a time (see http.ts).
const PARALLEL_BOARDS = 8
// The repo is public, so Actions logs are too: in CI only counts are printed, never which jobs.
const SHOW_JOBS = !process.env.GITHUB_ACTIONS

type SourceStat = { source: string; postings: number; error: string | null }
type IntakeResponse = {
  inserted_count: number
  skipped_duplicate_count: number
  invalid_count: number
  invalid?: Array<{ index: number; errors: string[] }>
  possible_duplicates?: unknown[]
}
type ScoredJob = { job: IntakeJob; breakdown: Breakdown; sponsorTier: SponsorTier }

const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8')) as T

const fetchCompany = (company: Company, profile: Profile) => {
  switch (company.ats) {
    case 'greenhouse': return fetchGreenhouse(company)
    case 'lever': return fetchLever(company)
    case 'ashby': return fetchAshby(company)
    case 'workday': return fetchWorkday(company, profile)
  }
}

const collect = async (label: string, stats: SourceStat[], load: () => Promise<RawPosting[]>) => {
  try {
    const postings = await load()
    stats.push({ source: label, postings: postings.length, error: null })
    console.log(`  ${label}: ${postings.length}`)
    return postings
  } catch (error) {
    stats.push({ source: label, postings: 0, error: String(error) })
    console.warn(`  ${label}: FAILED ${String(error)}`)
    return []
  }
}

const linkKey = (url: string) => stripTracking(url).toLowerCase().replace(/\/+$/, '')
const roleKey = (job: IntakeJob) => `${job.company.toLowerCase()}\u0000${job.role_title.toLowerCase()}`

// The same posting can arrive from a company board and from Simplify; keep the best-scoring copy.
// Direct sources are collected first, so on a tie the version with a full description wins.
const dedupe = (jobs: ScoredJob[]) => {
  const byKey = new Map<string, ScoredJob>()
  for (const entry of jobs) {
    const existing = byKey.get(linkKey(entry.job.job_link)) ?? byKey.get(roleKey(entry.job))
    if (existing && existing.job.match_score >= entry.job.match_score) continue
    if (existing) {
      byKey.delete(linkKey(existing.job.job_link))
      byKey.delete(roleKey(existing.job))
    }
    byKey.set(linkKey(entry.job.job_link), entry)
    byKey.set(roleKey(entry.job), entry)
  }
  return [...new Set(byKey.values())]
}

const sendToIntake = async (jobs: IntakeJob[]) => {
  const url = process.env.JOB_INTAKE_URL
  const token = process.env.JOB_INTAKE_TOKEN
  if (!url || !token) throw new Error('JOB_INTAKE_URL and JOB_INTAKE_TOKEN must be set (or pass --dry-run).')

  const totals = { inserted: 0, skipped: 0, invalid: 0, possibleDuplicates: 0 }
  for (let start = 0; start < jobs.length; start += BATCH_SIZE) {
    const batch = jobs.slice(start, start + BATCH_SIZE)
    const result = await postJson<IntakeResponse>(url, { jobs: batch }, { Authorization: `Bearer ${token}` })
    totals.inserted += result.inserted_count
    totals.skipped += result.skipped_duplicate_count
    totals.invalid += result.invalid_count
    totals.possibleDuplicates += result.possible_duplicates?.length ?? 0
    for (const row of result.invalid ?? []) {
      const label = SHOW_JOBS ? `${batch[row.index]?.company} — ${batch[row.index]?.role_title}` : `row ${start + row.index}`
      console.warn(`  invalid: ${label}: ${row.errors.join(' ')}`)
    }
  }
  return totals
}

const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  // --limit=N sends only the top N jobs, e.g. a one-row test of the intake connection.
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
  const limit = limitArg ? Number(limitArg) : null
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error(`--limit must be a positive integer, got "${limitArg}".`)
  const profile = await readJson<Profile>('config/profile.json')
  const companies = await readJson<Company[]>('config/companies.json')
  const sponsors = indexSponsors(fromSponsorFile(await readJson<SponsorFile>('data/h1b-sponsors.json')))
  // Board companies may list the USCIS spelling in h1bNames; Simplify jobs at those companies use it too.
  const h1bNames = new Map(companies.map((company) => [company.name.toLowerCase(), company.h1bNames]))
  const sponsorCache = new Map<string, SponsorRecord>()
  const sponsorFor = (company: string) => {
    const key = company.toLowerCase()
    let record = sponsorCache.get(key)
    if (!record) {
      record = lookupSponsor(sponsors, company, profile.sponsorTiers, h1bNames.get(key))
      sponsorCache.set(key, record)
    }
    return record
  }
  const sourceStats: SourceStat[] = []

  console.log(`Fetching ${companies.length} company boards…`)
  const perCompany = await mapWithConcurrency(companies, PARALLEL_BOARDS, (company) => (
    collect(`${company.ats}:${company.name}`, sourceStats, () => fetchCompany(company, profile))
  ))
  const postings: RawPosting[] = perCompany.flat()

  console.log('Fetching Simplify lists…')
  const simplify = (await collect('simplify', sourceStats, () => fetchSimplify(profile)))
    // Skip non-US listings before spending enrichment requests on them.
    .filter((posting) => scoreLocation(posting.location, profile).points !== null)
  console.log(`Enriching up to ${profile.maxEnrichPerRun} Simplify postings with descriptions…`)
  const enrichStats = await enrichPostings(simplify, profile.maxEnrichPerRun)
  postings.push(...simplify)

  const dropped: Record<string, number> = {}
  const blocked: Array<{ company: string; title: string; url: string; reason: string }> = []
  const kept: ScoredJob[] = []
  for (const posting of postings) {
    const sponsor = sponsorFor(posting.company)
    const result = evaluatePosting(posting, profile, sponsor)
    if (result.kind === 'irrelevant') dropped[result.reason] = (dropped[result.reason] ?? 0) + 1
    else if (result.kind === 'blocked') blocked.push({ company: posting.company, title: posting.title, url: posting.url, reason: result.reason })
    else kept.push({ job: result.job, breakdown: result.breakdown, sponsorTier: sponsor.tier })
  }

  const unique = dedupe(kept)
  // Internships have their own slots so full-time roles can't crowd them out.
  const ranked = unique
    .filter((entry) => entry.job.match_score >= profile.minScore)
    .sort((a, b) => b.job.match_score - a.job.match_score)
  const selected = [
    ...ranked.filter((entry) => entry.job.job_type !== 'Internship').slice(0, profile.maxPerRun),
    ...ranked.filter((entry) => entry.job.job_type === 'Internship').slice(0, profile.maxInternshipsPerRun),
  ].sort((a, b) => b.job.match_score - a.job.match_score)
  const sent = selected.slice(0, limit ?? selected.length)
  const jobs = sent.map((entry) => entry.job)
  const sponsorTiers: Record<SponsorTier, number> = { strong: 0, some: 0, rare: 0, none: 0 }
  for (const entry of sent) sponsorTiers[entry.sponsorTier] += 1

  const counts = {
    fetched: postings.length,
    dropped,
    blockedClearance: blocked.length,
    kept: kept.length,
    unique: unique.length,
    aboveMinScore: unique.filter((entry) => entry.job.match_score >= profile.minScore).length,
    selected: jobs.length,
    internships: jobs.filter((job) => job.job_type === 'Internship').length,
    citizenshipFlagged: jobs.filter((job) => job.sponsorship_notes?.includes('Citizenship stated')).length,
    noSponsorshipFlagged: jobs.filter((job) => job.sponsorship_notes?.includes('No sponsorship')).length,
    // USCIS New Employment tier of the selected jobs' companies (counts only — the repo is public).
    sponsorTiers,
  }

  console.log('\nSummary', JSON.stringify({ ...counts, enrich: enrichStats }, null, 2))
  if (SHOW_JOBS) {
    console.log(`\nTop ${Math.min(TOP_PRINTED, jobs.length)}:`)
    for (const job of jobs.slice(0, TOP_PRINTED)) {
      console.log(`  ${String(job.match_score).padStart(3)}  ${job.job_type.padEnd(18)} ${job.company} — ${job.role_title} (${shortLocation(job.location, profile)})`)
    }
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ runAt: new Date().toISOString(), dryRun, counts, enrich: enrichStats, sources: sourceStats, blocked, jobs: selected }, null, 2),
  )

  let intake: Awaited<ReturnType<typeof sendToIntake>> | null = null
  if (!dryRun) {
    console.log(`\nSending ${jobs.length} jobs to job-intake…`)
    intake = await sendToIntake(jobs)
    console.log('Intake', JSON.stringify(intake))
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const failed = sourceStats.filter((stat) => stat.error)
    const lines = [
      `## Job discovery ${dryRun ? '(dry run)' : ''}`,
      `Fetched **${counts.fetched}** postings · blocked (clearance) **${counts.blockedClearance}** · selected **${counts.selected}** (≥ ${profile.minScore})`,
      `Internships ${counts.internships} · citizenship-flagged ${counts.citizenshipFlagged} · no-sponsorship-flagged ${counts.noSponsorshipFlagged}`,
      `USCIS sponsor tier: strong ${sponsorTiers.strong} · some ${sponsorTiers.some} · rare ${sponsorTiers.rare} · none on record ${sponsorTiers.none}`,
      intake ? `Intake: inserted **${intake.inserted}**, skipped duplicates ${intake.skipped}, invalid ${intake.invalid}` : '',
      failed.length > 0 ? `\n**Failed sources:** ${failed.map((stat) => stat.source).join(', ')}` : '',
      'Review the new rows in /jobs (status: Found).',
    ]
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.filter(Boolean).join('\n')}\n`)
  }

  if (sourceStats.every((stat) => stat.error)) throw new Error('Every source failed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
