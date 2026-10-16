// job-link-check: the daily closed-posting check reads open jobs (GET) and sends what each job board said (POST).
// Same shape as job-screening: its own bearer token, one configured user, service-role client.
// Writes only touch that user's non-archived rows still in a checked or note-only status (see strikes.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  CHECKED_STATUSES,
  NOTE_ONLY_STATUSES,
  STRIKES_TO_CLOSE,
  nextLinkState,
  validateLinkCheck,
  type LinkCheck,
  type LinkRow,
} from './strikes.ts'

const PAGE_SIZE = 1000
const MAX_RESULTS = 100
const ROW_FIELDS = 'id, status, notes, link_status, link_missing_count, link_checked_at'
const ALL_STATUSES: readonly string[] = [...CHECKED_STATUSES, ...NOTE_ONLY_STATUSES]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
)

const quoted = (statuses: readonly string[]) => statuses.map((status) => `"${status}"`).join(',')
// Checked statuses always; applied ones only until their note has been added.
const OPEN_JOBS_FILTER = `status.in.(${quoted(CHECKED_STATUSES)}),and(status.in.(${quoted(NOTE_ONLY_STATUSES)}),link_missing_count.lt.${STRIKES_TO_CLOSE})`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const expectedToken = Deno.env.get('JOB_LINK_CHECK_TOKEN')
  const userId = Deno.env.get('JOB_INTAKE_USER_ID')
  if (!expectedToken || !userId) return jsonResponse({ error: 'JOB_LINK_CHECK_TOKEN and JOB_INTAKE_USER_ID must be configured.' }, 500)

  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  if (scheme !== 'Bearer' || !token || token !== expectedToken) return jsonResponse({ error: 'Unauthorized.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (req.method === 'GET') {
      const jobs: unknown[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, company, job_link')
          .eq('user_id', userId)
          .eq('archived', false)
          .not('job_link', 'is', null)
          .or(OPEN_JOBS_FILTER)
          .order('id')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        jobs.push(...(data ?? []))
        if ((data ?? []).length < PAGE_SIZE) break
      }
      return jsonResponse({ jobs })
    }

    let parsed: unknown
    try {
      parsed = await req.json()
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
    }
    const results = (parsed as { results?: unknown })?.results
    if (!Array.isArray(results)) return jsonResponse({ error: 'Request body must be { "results": [...] }.' }, 400)
    if (results.length > MAX_RESULTS) return jsonResponse({ error: `At most ${MAX_RESULTS} results per request.` }, 400)

    const invalid: Array<{ index: number; errors: string[] }> = []
    const valid: LinkCheck[] = []
    results.forEach((input, index) => {
      const { check, errors } = validateLinkCheck(input)
      if (check) valid.push(check)
      else invalid.push({ index, errors })
    })

    const { data: current, error: readError } = valid.length === 0 ? { data: [], error: null } : await supabase
      .from('jobs')
      .select(ROW_FIELDS)
      .eq('user_id', userId)
      .eq('archived', false)
      .in('id', valid.map((check) => check.id))
    if (readError) throw readError
    const rows = new Map((current ?? []).map((row) => [row.id as string, row as LinkRow & { id: string }]))

    const now = new Date()
    const counts = { open: 0, missing: 0, unverified: 0, closed: 0, noted: 0, not_found_count: 0 }
    for (const check of valid) {
      const row = rows.get(check.id)
      if (!row || !ALL_STATUSES.includes(row.status)) {
        counts.not_found_count++
        continue
      }
      const { patch, outcome } = nextLinkState(row, check, now)
      // Guarded by the status it was read with, so a job moved in the dashboard meanwhile is left alone.
      const { data: updated, error: updateError } = await supabase
        .from('jobs')
        .update(patch)
        .eq('id', check.id)
        .eq('user_id', userId)
        .eq('archived', false)
        .eq('status', row.status)
        .select('id')
      if (updateError) throw updateError
      if ((updated ?? []).length === 0) {
        counts.not_found_count++
        continue
      }
      counts[check.result]++
      if (outcome) counts[outcome]++
    }

    return jsonResponse({ ...counts, invalid_count: invalid.length, invalid })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
