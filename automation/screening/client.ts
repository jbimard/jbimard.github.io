// Used by the Claude screening routine (see ROUTINE.md). No AI calls here: it only moves data.
// Usage:
//   node automation/screening/client.ts pull [--limit=10] [--out=jobs.json]   unscreened Found jobs
//   node automation/screening/client.ts push results.json [--dry-run]         validate, then send
//   node automation/screening/client.ts sponsor "Company name"                USCIS lookup (local file)
// pull/push need JOB_SCREENING_URL and JOB_SCREENING_TOKEN in the environment.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchJson, postJson } from '../http.ts'
import { fromSponsorFile, indexSponsors, lookupSponsor, searchSponsors, type SponsorFile } from '../rules/sponsors.ts'
import type { Profile } from '../types.ts'
import { validateScreeningResult } from './results.ts'

const ROOT = path.join(import.meta.dirname, '..')

const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

const endpoint = () => {
  const url = process.env.JOB_SCREENING_URL
  const token = process.env.JOB_SCREENING_TOKEN
  if (!url || !token) throw new Error('JOB_SCREENING_URL and JOB_SCREENING_TOKEN must be set.')
  return { url, headers: { Authorization: `Bearer ${token}` } }
}

const pull = async () => {
  const { url, headers } = endpoint()
  const limit = option('limit') ?? '10'
  const data = await fetchJson<{ jobs: unknown[] }>(`${url}?limit=${encodeURIComponent(limit)}`, { headers })
  const out = option('out')
  if (out) {
    await writeFile(out, `${JSON.stringify(data.jobs, null, 2)}\n`)
    console.log(`Wrote ${data.jobs.length} job(s) to ${out}`)
  } else {
    console.log(JSON.stringify(data.jobs, null, 2))
  }
}

const push = async () => {
  const file = process.argv[3]
  if (!file || file.startsWith('--')) throw new Error('Usage: push results.json [--dry-run]')
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
  const results = Array.isArray(parsed) ? parsed : (parsed as { results?: unknown[] }).results
  if (!Array.isArray(results)) throw new Error('The file must hold an array of results or { "results": [...] }.')

  // Validate everything first so a half-good file is never half-sent.
  const problems = results
    .map((result, index) => ({ index, errors: validateScreeningResult(result).errors }))
    .filter((entry) => entry.errors.length > 0)
  for (const { index, errors } of problems) console.error(`result ${index}: ${errors.join(' ')}`)
  if (problems.length > 0) throw new Error(`${problems.length} of ${results.length} result(s) are invalid; nothing was sent.`)

  if (process.argv.includes('--dry-run')) {
    console.log(`All ${results.length} result(s) are valid (dry run, nothing sent).`)
    return
  }
  const { url, headers } = endpoint()
  const response = await postJson<Record<string, unknown>>(url, { results }, headers)
  console.log(JSON.stringify(response, null, 2))
}

const sponsor = async () => {
  const company = process.argv.slice(3).filter((arg) => !arg.startsWith('--')).join(' ').trim()
  if (!company) throw new Error('Usage: sponsor "Company name"')
  const file = JSON.parse(await readFile(path.join(ROOT, 'data/h1b-sponsors.json'), 'utf8')) as SponsorFile
  const profile = JSON.parse(await readFile(path.join(ROOT, 'config/profile.json'), 'utf8')) as Profile
  const index = indexSponsors(fromSponsorFile(file))
  const match = lookupSponsor(index, company, profile.sponsorTiers)
  console.log(JSON.stringify({
    query: company,
    fiscalYears: file.fiscalYears,
    partialYear: file.partialYear,
    tierThresholds: profile.sponsorTiers,
    // What discovery would have matched on its own.
    discoveryMatch: { tier: match.tier, fiscalYear: match.fiscalYear, count: match.count, byYear: match.byYear, names: match.matchedNames },
    // Wider net: pick the entity that is really this employer, if any.
    candidates: searchSponsors(index, company),
  }, null, 2))
}

const commands: Record<string, () => Promise<void>> = { pull, push, sponsor }
const command = commands[process.argv[2] ?? '']
if (!command) {
  console.error('Usage: client.ts pull | push <file> [--dry-run] | sponsor "<company>"')
  process.exit(1)
}
command().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
