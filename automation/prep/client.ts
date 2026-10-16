// Used by the Claude preparation routine (see ROUTINE.md). No AI calls here: it only moves and checks data.
// Usage:
//   node automation/prep/client.ts pull [--limit=5]                approved jobs without a packet → /tmp/prep-jobs.json,
//                                                                   base resumes → /tmp/prep-base.json
//   node automation/prep/client.ts push packets.json [--dry-run]   validate against the pulled base, then send
//   node automation/prep/client.ts base check [file]               validate a base-resumes.json (no network)
//   node automation/prep/client.ts base upload [file]              validate, then store it in the private bucket
// pull/push/upload need JOB_PREP_URL. The token comes from JOB_PREP_TOKEN when set (local runs); in the cloud routine
// it's a network secret that Anthropic's proxy adds to requests, so the session never sees it.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchJson, postJson } from '../http.ts'
import { checkPacket } from './check.ts'
import { buildVocabulary, resolveResume, splitSkills, validateBase, validatePacket, type BaseResumes } from './packet.ts'

const ROOT = path.join(import.meta.dirname, '..')
const JOBS_FILE = '/tmp/prep-jobs.json'
const BASE_FILE = '/tmp/prep-base.json'
const DEFAULT_BASE = path.join(ROOT, 'private/base-resumes.json')

type PulledJob = { id: string; company: string; role_title: string; required_skills: string | null; job_description: string | null }

const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const positional = (index: number) => process.argv.slice(2).filter((arg) => !arg.startsWith('--'))[index]
const readJsonFile = async <T>(file: string) => JSON.parse(await readFile(file, 'utf8')) as T

const endpoint = () => {
  const url = process.env.JOB_PREP_URL
  if (!url) throw new Error('JOB_PREP_URL must be set.')
  const token = process.env.JOB_PREP_TOKEN
  // No token here means the network secret supplies the Authorization header on the way out.
  return { url, headers: token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string> }
}

const pull = async () => {
  const { url, headers } = endpoint()
  const limit = option('limit') ?? '5'
  const data = await fetchJson<{ jobs: PulledJob[]; base: BaseResumes }>(`${url}?limit=${encodeURIComponent(limit)}`, { headers })
  await writeFile(JOBS_FILE, `${JSON.stringify(data.jobs, null, 2)}\n`)
  await writeFile(BASE_FILE, `${JSON.stringify(data.base, null, 2)}\n`)
  console.log(`Wrote ${data.jobs.length} job(s) to ${JOBS_FILE} and the base resumes to ${BASE_FILE}`)
}

const push = async () => {
  const file = positional(1)
  if (!file) throw new Error('Usage: push packets.json [--dry-run] [--jobs=/tmp/prep-jobs.json] [--base=/tmp/prep-base.json]')
  const parsed = await readJsonFile<unknown>(file)
  const packets = Array.isArray(parsed) ? parsed : (parsed as { packets?: unknown[] }).packets
  if (!Array.isArray(packets)) throw new Error('The file must hold an array of packets or { "packets": [...] }.')
  const base = validateBase(await readJsonFile(option('base') ?? BASE_FILE)).base
  if (!base) throw new Error('The base file is invalid; run pull again.')
  const jobs = new Map((await readJsonFile<PulledJob[]>(option('jobs') ?? JOBS_FILE)).map((job) => [job.id, job]))

  // Validate everything first so a half-good file is never half-sent. Same checks the function runs.
  let problems = 0
  packets.forEach((packet, index) => {
    const job = jobs.get((packet as { job_id?: string })?.job_id ?? '')
    if (!job) {
      problems++
      console.error(`packet ${index}: job_id is not one of the pulled jobs.`)
      return
    }
    const { packet: valid, errors } = validatePacket(packet, base, buildVocabulary(base, splitSkills(job.required_skills)))
    for (const error of errors) console.error(`packet ${index}: ${error}`)
    if (!valid) {
      problems++
      return
    }
    // The same Resume check the function stores: red flags block approval, yellow ones need a look.
    // Same fallback as job-prep: score against the posting text the routine read when the job has no description.
    const posting = job.job_description?.trim() ? job : { ...job, job_description: valid.posting_text ?? null }
    const check = checkPacket(valid, base, resolveResume(valid, base), posting)
    console.log(`packet ${index}: Resume check ${check.status.toUpperCase()}, ATS estimate ${check.ats.score ?? 'n/a'} (base ${check.ats.base_score ?? 'n/a'})`)
    for (const flag of check.flags) console.log(`  ${flag.severity} ${flag.rule} ${flag.path}: ${flag.message}`)
    const met = (kind: string) => `${valid.qualifications?.filter((q) => q.kind === kind && q.met).length ?? 0}/${valid.qualifications?.filter((q) => q.kind === kind).length ?? 0}`
    console.log(valid.qualifications ? `  qualifications met: basic ${met('basic')}, preferred ${met('preferred')}` : '  no qualifications listed (add them, see ROUTINE.md)')
    // Red flags are never sent: rewrite until they're gone. Yellow ones go through for his review.
    if (check.status === 'blocked') {
      problems++
      console.error(`packet ${index}: has red flags; fix them before sending.`)
    }
  })
  if (problems > 0) throw new Error(`${problems} of ${packets.length} packet(s) are invalid; nothing was sent.`)
  if (process.argv.includes('--dry-run')) {
    console.log(`All ${packets.length} packet(s) are valid (dry run, nothing sent).`)
    return
  }
  const { url, headers } = endpoint()
  console.log(JSON.stringify(await postJson<Record<string, unknown>>(url, { packets }, headers), null, 2))
}

const base = async () => {
  const action = positional(1)
  const file = positional(2) ?? DEFAULT_BASE
  const { base: valid, errors } = validateBase(await readJsonFile(file))
  for (const error of errors) console.error(error)
  if (!valid) throw new Error(`${file} is invalid.`)
  const entries = Object.values(valid.versions).reduce((sum, doc) => sum + doc.experience.length + doc.projects.length, 0)
  console.log(`${file} is valid: 3 versions, ${entries} entries, ${valid.workAuthorization.length} work-authorization answers.`)
  if (action === 'check') return
  if (action !== 'upload') throw new Error('Usage: base check|upload [file]')
  const { url, headers } = endpoint()
  const response = await fetch(`${url}?base`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })
  const body = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(`Upload failed (HTTP ${response.status}): ${JSON.stringify(body)}`)
  console.log('Stored in the private bucket.')
}

const commands: Record<string, () => Promise<void>> = { pull, push, base }
const command = commands[process.argv[2] ?? '']
if (!command) {
  console.error('Usage: client.ts pull | push <file> [--dry-run] | base check|upload [file]')
  process.exit(1)
}
command().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
