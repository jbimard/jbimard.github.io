// Daily closed-posting check: read open jobs from the job-link-check Edge Function, ask each job board whether the
// posting is still there, and send the results back (the function applies the two-strike rule). No AI calls.
// Usage: node automation/links/check.ts [--dry-run] [--rows=file.json]
//   --rows reads jobs from a file instead of the function ({ id?, company, job_link }[], or a discovery report.json)
//   and implies --dry-run.
import { appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { mapWithConcurrency, postJson, fetchJson } from '../http.ts'
import type { Company } from '../types.ts'
import { createChecker, greenhouseFromJid, liveProbes, parseBoardUrl, type Check } from './boards.ts'
import { LINK_RESULTS, LINK_VIAS, type LinkCheck } from './strikes.ts'

type Row = { id: string; company: string; job_link: string }
type PushResponse = Record<'open' | 'missing' | 'unverified' | 'closed' | 'noted' | 'invalid_count' | 'not_found_count', number>

const ROOT = path.join(import.meta.dirname, '..')
const BATCH_SIZE = 100
// Different hosts run in parallel; each host still gets one request at a time (see http.ts).
const PARALLEL_CHECKS = 8

const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

const readRows = async (file: string): Promise<Row[]> => {
  const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
  // A discovery report holds { jobs: [{ job: IntakeJob }] }.
  const list = Array.isArray(parsed) ? parsed : ((parsed as { jobs?: unknown[] }).jobs ?? [])
  return list.map((entry, index) => {
    const row = ((entry as { job?: unknown }).job ?? entry) as Partial<Row>
    return { id: row.id ?? `row-${index}`, company: row.company ?? '', job_link: row.job_link ?? '' }
  })
}

const main = async () => {
  const rowsFile = option('rows')
  const dryRun = Boolean(rowsFile) || process.argv.includes('--dry-run')
  const url = process.env.JOB_LINK_CHECK_URL
  const token = process.env.JOB_LINK_CHECK_TOKEN
  if (!rowsFile && (!url || !token)) {
    // Not set up yet (docs/JOBS_SETUP.md §12): don't fail the discovery workflow over it.
    console.log('Link check not configured (JOB_LINK_CHECK_URL / JOB_LINK_CHECK_TOKEN); skipping.')
    return
  }
  const headers = { Authorization: `Bearer ${token}` }

  const rows = rowsFile ? await readRows(rowsFile) : (await fetchJson<{ jobs: Row[] }>(url!, { headers })).jobs
  const companies = JSON.parse(await readFile(path.join(ROOT, 'config/companies.json'), 'utf8')) as Company[]
  const check = createChecker(liveProbes())

  console.log(`Checking ${rows.length} posting(s)…`)
  const checks: Array<LinkCheck & Check> = await mapWithConcurrency(rows, PARALLEL_CHECKS, async (row) => {
    const ref = parseBoardUrl(row.job_link) ?? greenhouseFromJid(row.job_link, row.company, companies)
    return { id: row.id, ...(await check(row.job_link, ref)) }
  })

  // Counts only: the repo is public, so Actions logs never name a company or link.
  const byResult = Object.fromEntries(LINK_RESULTS.map((result) => [result, checks.filter((entry) => entry.result === result).length]))
  const byVia = Object.fromEntries(LINK_VIAS.map((via) => [via, Object.fromEntries(
    LINK_RESULTS.map((result) => [result, checks.filter((entry) => entry.via === via && entry.result === result).length]),
  )]).filter(([, counts]) => Object.values(counts as Record<string, number>).some(Boolean)))
  console.log('Checked', JSON.stringify({ total: checks.length, ...byResult, byVia }, null, 2))

  let pushed: PushResponse | null = null
  if (!dryRun) {
    pushed = { open: 0, missing: 0, unverified: 0, closed: 0, noted: 0, invalid_count: 0, not_found_count: 0 }
    for (let start = 0; start < checks.length; start += BATCH_SIZE) {
      const results = checks.slice(start, start + BATCH_SIZE).map(({ id, result, via }) => ({ id, result, via }))
      const response = await postJson<PushResponse>(url!, { results }, headers)
      for (const key of Object.keys(pushed) as Array<keyof PushResponse>) pushed[key] += response[key] ?? 0
    }
    console.log('Saved', JSON.stringify(pushed))
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Closed-posting check ${dryRun ? '(dry run)' : ''}`,
      `Checked **${checks.length}** · open ${byResult.open} · missing ${byResult.missing} · couldn't verify ${byResult.unverified}`,
      pushed ? `Archived as Closed **${pushed.closed}** · noted on applied jobs ${pushed.noted} · not found ${pushed.not_found_count} · invalid ${pushed.invalid_count}` : '',
      'A job closes after two "missing" checks on different days; one strike keeps it out of the next batch.',
    ]
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.filter(Boolean).join('\n')}\n`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
