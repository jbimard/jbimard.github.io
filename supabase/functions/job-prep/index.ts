// job-prep: the Claude preparation routine reads approved jobs plus the private base resumes (GET) and sends one
// packet per job (POST); the function validates it, renders the .docx files and stores them in the private bucket.
// PUT ?base uploads a reviewed base-resumes.json. Same shape as job-screening: its own bearer token, one configured
// user, service-role client. Writes only touch that user's Ready to Apply jobs that don't have a packet yet.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ANSWER_QUESTIONS, buildVocabulary, resolveResume, splitSkills, validateBase, validatePacket, type BaseResumes } from '../_shared/packet.ts'
import { checkPacket } from '../_shared/check.ts'
import { fileStem, renderCoverLetter, renderResume } from '../_shared/render.ts'
import { PAGE_HEIGHT, measureResumePdf, renderCoverLetterPdf, renderResumePdf } from '../_shared/render_pdf.ts'

const BUCKET = 'application-packets'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF = 'application/pdf'
const MAX_LIMIT = 10
const MAX_PACKETS = 5
const PULL_FIELDS = 'id, company, role_title, location, job_link, job_type, work_mode, match_score, required_skills, sponsorship_notes, graduation_requirement, job_description, resume_version, screening'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (!['GET', 'POST', 'PUT'].includes(req.method)) return jsonResponse({ error: 'Method not allowed.' }, 405)

  const expectedToken = Deno.env.get('JOB_PREP_TOKEN')
  const userId = Deno.env.get('JOB_INTAKE_USER_ID')
  if (!expectedToken || !userId) return jsonResponse({ error: 'JOB_PREP_TOKEN and JOB_INTAKE_USER_ID must be configured.' }, 500)

  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  if (scheme !== 'Bearer' || !token || token !== expectedToken) return jsonResponse({ error: 'Unauthorized.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const storage = supabase.storage.from(BUCKET)
  const basePath = `${userId}/base/base-resumes.json`

  const loadBase = async (): Promise<BaseResumes | null> => {
    const { data, error } = await storage.download(basePath)
    if (error || !data) return null
    return validateBase(JSON.parse(await data.text())).base
  }

  // Ready to Apply jobs of this user with no packet yet.
  const waitingJobs = async (ids: string[] | null, limit: number) => {
    let query = supabase.from('jobs').select(PULL_FIELDS).eq('user_id', userId).eq('status', 'Ready to Apply').eq('archived', false)
    if (ids) query = query.in('id', ids)
    const { data: jobs, error } = await query.order('match_score', { ascending: false, nullsFirst: false }).limit(ids ? ids.length : 200)
    if (error) throw error
    if (!jobs || jobs.length === 0) return []
    const { data: packets, error: packetError } = await supabase.from('application_packets').select('job_id').in('job_id', jobs.map((job) => job.id))
    if (packetError) throw packetError
    const done = new Set((packets ?? []).map((packet) => packet.job_id))
    return jobs.filter((job) => !done.has(job.id)).slice(0, limit)
  }

  try {
    if (req.method === 'PUT') {
      if (!new URL(req.url).searchParams.has('base')) return jsonResponse({ error: 'Use PUT ?base to upload base-resumes.json.' }, 400)
      let parsed: unknown
      try {
        parsed = await req.json()
      } catch {
        return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
      }
      const { base, errors } = validateBase(parsed)
      if (!base) return jsonResponse({ error: 'Invalid base file.', errors }, 400)
      const { error } = await storage.upload(basePath, new Blob([JSON.stringify(base)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
      if (error) throw error
      return jsonResponse({ stored: true })
    }

    const base = await loadBase()
    if (!base) return jsonResponse({ error: 'No valid base-resumes.json in the bucket yet. Upload it first (docs/JOBS_SETUP.md §13).' }, 409)

    if (req.method === 'GET') {
      const requested = Number(new URL(req.url).searchParams.get('limit') ?? 5)
      const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : 5
      return jsonResponse({ jobs: await waitingJobs(null, limit), base })
    }

    let parsed: unknown
    try {
      parsed = await req.json()
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
    }
    const packets = (parsed as { packets?: unknown })?.packets
    if (!Array.isArray(packets)) return jsonResponse({ error: 'Request body must be { "packets": [...] }.' }, 400)
    if (packets.length > MAX_PACKETS) return jsonResponse({ error: `At most ${MAX_PACKETS} packets per request.` }, 400)

    const ids = packets.map((packet) => (packet as { job_id?: unknown })?.job_id).filter((id): id is string => typeof id === 'string')
    const jobs = new Map((await waitingJobs(ids, ids.length)).map((job) => [job.id as string, job]))

    const created: string[] = []
    const invalid: Array<{ index: number; errors: string[] }> = []
    const notFound: Array<{ index: number; job_id: unknown }> = []
    let warningCount = 0
    const statusCounts = { pass: 0, needs_edits: 0, blocked: 0 }
    const now = new Date()

    for (const [index, input] of packets.entries()) {
      const jobId = (input as { job_id?: unknown })?.job_id
      const job = typeof jobId === 'string' ? jobs.get(jobId) : undefined
      if (!job) {
        notFound.push({ index, job_id: jobId })
        continue
      }
      const { packet, errors, warnings } = validatePacket(input, base, buildVocabulary(base, splitSkills(job.required_skills)))
      if (!packet) {
        invalid.push({ index, errors })
        continue
      }

      const resume = resolveResume(packet, base)
      // No saved description (common for Workday imports): score against the posting text the routine read, and keep it
      // on the job so later checks (edits, regenerations) have it too. The packet itself doesn't store it.
      const { posting_text: postingText, ...storedPacket } = packet
      if (!job.job_description?.trim() && postingText?.trim()) {
        job.job_description = postingText.trim()
        const { error: describeError } = await supabase.from('jobs').update({ job_description: job.job_description }).eq('id', job.id).eq('user_id', userId)
        if (describeError) throw describeError
      }
      // Resume check (step 3c): verdict, flags, side-by-side comparisons and the ATS estimate, stored with the packet.
      const check = checkPacket(packet, base, resume, job)
      // One page, measured on the real PDF (the check's estimate is what the routine sees first).
      const { pages, used } = await measureResumePdf(resume)
      if (pages > 1) {
        invalid.push({ index, errors: [`The resume renders to ${pages} pages, about ${Math.ceil((used - PAGE_HEIGHT) / 12.6)} lines too long; drop or shorten bullets.`] })
        continue
      }
      const stem = fileStem(base.contact.name)
      const folder = `${userId}/${job.id}`
      const resumePath = `${folder}/${stem}-Resume-${fileStem(job.company)}.docx`
      const letterPath = `${folder}/${stem}-Cover-Letter-${fileStem(job.company)}.docx`
      const pdfPath = (path: string) => path.replace(/\.docx$/, '.pdf')
      const files: Array<[string, Uint8Array<ArrayBuffer>, string]> = [
        [resumePath, await renderResume(resume), DOCX],
        [letterPath, await renderCoverLetter(base.contact, job, packet.cover_letter.paragraphs, now), DOCX],
        [pdfPath(resumePath), await renderResumePdf(resume), PDF],
        [pdfPath(letterPath), await renderCoverLetterPdf(base.contact, job, packet.cover_letter.paragraphs, now), PDF],
      ]
      for (const [path, bytes, type] of files) {
        const { error } = await storage.upload(path, new Blob([bytes], { type }), { upsert: true, contentType: type, cacheControl: '0' })
        if (error) throw error
      }

      const { error: insertError } = await supabase.from('application_packets').insert({
        user_id: userId,
        job_id: job.id,
        resume_version: packet.resume_version,
        resume_path: resumePath,
        cover_letter_path: letterPath,
        resume_pdf_path: pdfPath(resumePath),
        cover_letter_pdf_path: pdfPath(letterPath),
        resume_content: resume,
        // Kept so the dashboard can edit it later (packet-edit re-runs the same checks on it).
        packet: storedPacket,
        cover_letter: packet.cover_letter.paragraphs.join('\n\n'),
        answers: Object.entries(ANSWER_QUESTIONS).map(([key, question]) => ({ key, question, answer: packet.answers[key as keyof typeof ANSWER_QUESTIONS] })),
        work_authorization: base.workAuthorization,
        match_report: packet.match_report,
        warnings,
        check_status: check.status,
        check_flags: check.flags,
        comparisons: check.comparisons,
        ats: check.ats,
        checked_at: now.toISOString(),
      })
      // A packet created meanwhile (unique job_id) counts as not found; the files were simply overwritten.
      if (insertError?.code === '23505') {
        notFound.push({ index, job_id: jobId })
        continue
      }
      if (insertError) throw insertError
      created.push(job.id)
      warningCount += warnings.length
      statusCounts[check.status]++
    }

    return jsonResponse({
      created_count: created.length,
      invalid_count: invalid.length,
      not_found_count: notFound.length,
      warning_count: warningCount,
      check: statusCounts,
      created,
      invalid,
      not_found: notFound,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
