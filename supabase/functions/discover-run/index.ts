// discover-run: the dashboard's "Run lookup" button. Signed-in users only. Dispatches the "Daily job discovery"
// GitHub Actions workflow; the GitHub token lives only in Supabase secrets (GITHUB_DISPATCH_TOKEN, fine-grained,
// Actions: read/write on this repo). Refuses if a run is already queued or in progress.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const REPO = Deno.env.get('GITHUB_REPO') ?? 'jbimard/jbimard.github.io'
const WORKFLOW = 'discover-jobs.yml'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
)

const github = (path: string, init: RequestInit = {}) => fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}${path}`, {
  ...init,
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${Deno.env.get('GITHUB_DISPATCH_TOKEN')}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  const { data: auth } = scheme === 'Bearer' && token ? await supabase.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return jsonResponse({ error: 'Sign in to run the lookup.' }, 401)
  if (!Deno.env.get('GITHUB_DISPATCH_TOKEN')) return jsonResponse({ error: 'GITHUB_DISPATCH_TOKEN is not set (docs/JOBS_SETUP.md §10).' }, 500)

  try {
    for (const status of ['queued', 'in_progress']) {
      const runs = await github(`/runs?status=${status}&per_page=1`)
      if (!runs.ok) return jsonResponse({ error: `GitHub returned ${runs.status} when checking runs.` }, 502)
      if ((await runs.json()).total_count > 0) return jsonResponse({ error: 'A lookup is already running. Give it a few minutes.' }, 409)
    }
    const dispatch = await github('/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) })
    if (dispatch.status !== 204) return jsonResponse({ error: `GitHub returned ${dispatch.status} when starting the lookup.` }, 502)
    return jsonResponse({ started: true })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to start the lookup.' }, 500)
  }
})
