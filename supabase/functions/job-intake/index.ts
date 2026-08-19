import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  normalizeJobIntakeRow,
  toJobInsertRow,
  validateJobIntakeRow,
  type NormalizedJobIntake,
} from './validation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
)

const emptyResult = () => ({
  inserted_count: 0,
  skipped_duplicate_count: 0,
  invalid_count: 0,
  inserted: [],
  skipped_duplicates: [],
  invalid: [],
  possible_duplicates: [],
})

const normalizeUrl = (value: string | null) => value?.trim() ?? ''

const companyRoleKey = (company: string | null, roleTitle: string | null) => (
  `${company?.trim().toLowerCase() ?? ''}\u0000${roleTitle?.trim().toLowerCase() ?? ''}`
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const expectedToken = Deno.env.get('JOB_INTAKE_TOKEN')
  if (!expectedToken) {
    return jsonResponse({ error: 'JOB_INTAKE_TOKEN is not configured.' }, 500)
  }

  const authorization = req.headers.get('Authorization')
  const [scheme, token] = authorization?.split(/\s+/, 2) ?? []
  if (scheme !== 'Bearer' || !token || token !== expectedToken) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  let rawJobs: unknown[]
  if (Array.isArray(parsed)) {
    rawJobs = parsed
  } else if (
    typeof parsed === 'object'
    && parsed !== null
    && !Array.isArray(parsed)
    && Array.isArray((parsed as { jobs?: unknown }).jobs)
  ) {
    rawJobs = (parsed as { jobs: unknown[] }).jobs
  } else {
    return jsonResponse({ error: 'Request body must be a JSON array or an object with a jobs array.' }, 400)
  }

  if (rawJobs.length === 0) {
    return jsonResponse(emptyResult())
  }

  try {
    const userId = Deno.env.get('JOB_INTAKE_USER_ID')
    if (!userId) {
      return jsonResponse({ error: 'JOB_INTAKE_USER_ID is not configured.' }, 500)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: existingJobs, error: existingError } = await supabase
      .from('jobs')
      .select('job_link, company, role_title')
      .eq('user_id', userId)

    if (existingError) throw existingError

    const existingLinks = new Set(
      (existingJobs ?? []).map((job) => normalizeUrl(job.job_link)).filter((link) => link !== ''),
    )
    const existingCompanyRoles = new Set(
      (existingJobs ?? []).map((job) => companyRoleKey(job.company, job.role_title)),
    )
    const batchLinks = new Set<string>()

    const invalid: Array<{ index: number; job: NormalizedJobIntake; errors: string[] }> = []
    const skippedDuplicates: Array<{
      index: number
      job: NormalizedJobIntake
      reason: 'duplicate_job_link_existing' | 'duplicate_job_link_in_batch'
    }> = []
    const possibleDuplicates: Array<{ index: number; company: string; role_title: string }> = []
    const insertable: NormalizedJobIntake[] = []

    rawJobs.forEach((rawJob, index) => {
      const job = normalizeJobIntakeRow(rawJob)
      const errors = validateJobIntakeRow(job)

      if (errors.length > 0) {
        invalid.push({ index, job, errors })
        return
      }

      const link = normalizeUrl(job.job_link)
      if (link !== '' && existingLinks.has(link)) {
        skippedDuplicates.push({ index, job, reason: 'duplicate_job_link_existing' })
        return
      }

      if (link !== '' && batchLinks.has(link)) {
        skippedDuplicates.push({ index, job, reason: 'duplicate_job_link_in_batch' })
        return
      }

      if (existingCompanyRoles.has(companyRoleKey(job.company, job.role_title))) {
        possibleDuplicates.push({ index, company: job.company, role_title: job.role_title })
      }

      insertable.push(job)
      if (link !== '') batchLinks.add(link)
    })

    const insertRows = insertable.map((job) => toJobInsertRow(job, userId))
    const inserted = insertRows.length === 0
      ? []
      : await supabase
        .from('jobs')
        .insert(insertRows)
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error
          return data ?? []
        })

    return jsonResponse({
      inserted_count: inserted.length,
      skipped_duplicate_count: skippedDuplicates.length,
      invalid_count: invalid.length,
      inserted,
      skipped_duplicates: skippedDuplicates,
      invalid,
      possible_duplicates: possibleDuplicates,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
