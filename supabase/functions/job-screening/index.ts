// job-screening: the Claude screening routine reads unscreened Found jobs (GET) and writes results (POST).
// Same shape as job-intake: one bearer token, one configured user, service-role client.
// Writes only touch that user's Found rows that have not been screened, so a bad call can't move anything else.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { priorityOf, toStoredScreening, validateScreeningResult, type ScreeningResult } from './validation.ts'

const MAX_LIMIT = 25
const MAX_RESULTS = 50
const PULL_FIELDS = 'id, company, role_title, location, job_link, job_type, work_mode, match_score, required_skills, sponsorship_notes, graduation_requirement, e_verify_notes, job_description, notes, date_found'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const expectedToken = Deno.env.get('JOB_SCREENING_TOKEN')
  const userId = Deno.env.get('JOB_INTAKE_USER_ID')
  if (!expectedToken || !userId) return jsonResponse({ error: 'JOB_SCREENING_TOKEN and JOB_INTAKE_USER_ID must be configured.' }, 500)

  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  if (scheme !== 'Bearer' || !token || token !== expectedToken) return jsonResponse({ error: 'Unauthorized.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (req.method === 'GET') {
      const requested = Number(new URL(req.url).searchParams.get('limit') ?? 10)
      const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : 10
      const { data, error } = await supabase
        .from('jobs')
        .select(PULL_FIELDS)
        .eq('user_id', userId)
        .eq('status', 'Found')
        .eq('archived', false)
        .is('screened_at', null)
        .order('match_score', { ascending: false, nullsFirst: false })
        .limit(limit)
      if (error) throw error
      return jsonResponse({ jobs: data ?? [] })
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
    const valid: Array<{ index: number; result: ScreeningResult }> = []
    results.forEach((input, index) => {
      const { result, errors } = validateScreeningResult(input)
      if (result) valid.push({ index, result })
      else invalid.push({ index, errors })
    })

    const updated: string[] = []
    const notFound: Array<{ index: number; id: string }> = []
    for (const { index, result } of valid) {
      const { data: current, error: readError } = await supabase
        .from('jobs')
        .select('match_score')
        .eq('id', result.id)
        .eq('user_id', userId)
        .eq('status', 'Found')
        .is('screened_at', null)
        .maybeSingle()
      if (readError) throw readError
      if (!current) {
        notFound.push({ index, id: result.id })
        continue
      }

      const { data: rows, error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'Fit Check',
          match_score: result.score,
          priority: priorityOf(result.score),
          resume_version: result.resume_version,
          screening: toStoredScreening(result, current.match_score, 'claude-routine'),
          screened_at: new Date().toISOString(),
        })
        .eq('id', result.id)
        .eq('user_id', userId)
        .eq('status', 'Found')
        .is('screened_at', null)
        .select('id')
      if (updateError) throw updateError
      if ((rows ?? []).length === 0) notFound.push({ index, id: result.id })
      else updated.push(result.id)
    }

    return jsonResponse({
      updated_count: updated.length,
      invalid_count: invalid.length,
      not_found_count: notFound.length,
      updated,
      invalid,
      not_found: notFound,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
