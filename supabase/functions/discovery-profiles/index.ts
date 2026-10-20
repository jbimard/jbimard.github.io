// discovery-profiles: hands the daily discovery run the extra users' search profiles. Same bearer token as job-intake
// (JOB_INTAKE_TOKEN). Profiles live in the database, not the public repo, so a profile's job preferences stay private.
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  const expectedToken = Deno.env.get('JOB_INTAKE_TOKEN')
  if (!expectedToken) return jsonResponse({ error: 'JOB_INTAKE_TOKEN is not configured.' }, 500)
  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  if (scheme !== 'Bearer' || !token || token !== expectedToken) return jsonResponse({ error: 'Unauthorized.' }, 401)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, profile')
      .eq('enabled', true)
      .order('created_at')
    if (error) throw error
    return jsonResponse({ profiles: data ?? [] })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
