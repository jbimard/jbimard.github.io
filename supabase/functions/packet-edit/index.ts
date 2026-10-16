// packet-edit: the dashboard saves an edited packet (step 3c-B). Signed in as the packet's owner, never with a shared
// token. The edit runs through the same validator and Resume check as the routine; anything with an error or a red
// flag is refused and nothing changes. Otherwise the .docx and PDF files are rendered again under a new revision folder, the
// row is updated (guarded by the revision the dashboard opened), the old files are removed, and every changed line is
// kept in packet_edits as an example of his voice.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { applyEdit } from '../_shared/edit.ts'
import { ANSWER_QUESTIONS, buildVocabulary, resolveResume, splitSkills, validateBase, validatePacket, type BaseResumes, type Packet } from '../_shared/packet.ts'
import { checkPacket, type Flag } from '../_shared/check.ts'
import { fileStem, renderCoverLetter, renderResume } from '../_shared/render.ts'
import { renderCoverLetterPdf, renderResumePdf } from '../_shared/render_pdf.ts'

const BUCKET = 'application-packets'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF = 'application/pdf'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [scheme, token] = req.headers.get('Authorization')?.split(/\s+/, 2) ?? []
  const { data: auth } = scheme === 'Bearer' && token ? await supabase.auth.getUser(token) : { data: { user: null } }
  const userId = auth.user?.id
  if (!userId) return jsonResponse({ error: 'Sign in to edit a packet.' }, 401)

  let body: { packet_id?: unknown; revision?: unknown; edit?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (typeof body.packet_id !== 'string' || !Number.isInteger(body.revision)) return jsonResponse({ error: 'Send { packet_id, revision, edit }.' }, 400)

  try {
    const { data: row, error: rowError } = await supabase
      .from('application_packets')
      .select('id, job_id, packet, revision, resume_path, cover_letter_path, resume_pdf_path, cover_letter_pdf_path, check_flags, acknowledged_flags')
      .eq('id', body.packet_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (rowError) throw rowError
    if (!row) return jsonResponse({ error: 'Packet not found.' }, 404)
    if (!row.packet) return jsonResponse({ error: 'This packet was prepared before editing existed. Regenerate it to get an editable one.' }, 409)
    if (row.revision !== body.revision) return jsonResponse({ error: 'The packet changed since you opened it. Reload and edit again.' }, 409)

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, company, role_title, required_skills, job_description')
      .eq('id', row.job_id)
      .eq('user_id', userId)
      .single()
    if (jobError) throw jobError

    const { data: file, error: baseError } = await supabase.storage.from(BUCKET).download(`${userId}/base/base-resumes.json`)
    const base: BaseResumes | null = baseError || !file ? null : validateBase(JSON.parse(await file.text())).base
    if (!base) return jsonResponse({ error: 'No valid base-resumes.json in the bucket. Upload it first (docs/JOBS_SETUP.md §13).' }, 409)

    const stored = row.packet as Packet
    const applied = applyEdit(stored, body.edit, base)
    if (!applied.packet) return jsonResponse({ error: 'The edit was not saved.', errors: applied.errors }, 422)
    if (JSON.stringify(applied.packet) === JSON.stringify(stored)) return jsonResponse({ unchanged: true, revision: row.revision })

    // Same checks as a packet from the routine. The base may have changed since, so a stale bullet id shows up here.
    const { packet, errors, warnings } = validatePacket(applied.packet, base, buildVocabulary(base, splitSkills(job.required_skills)))
    if (!packet) return jsonResponse({ error: 'The edit was not saved.', errors }, 422)
    const resume = resolveResume(packet, base)
    const check = checkPacket(packet, base, resume, job)
    if (check.status === 'blocked') {
      return jsonResponse({ error: 'The edit was not saved: it has red flags.', flags: check.flags.filter((flag) => flag.severity === 'red') }, 422)
    }

    // New files (.docx and .pdf) under r<revision>/ with the same names, so the file sent to employers is never called "-r2".
    const revision = row.revision + 1
    const folder = `${userId}/${job.id}/r${revision}`
    const stem = fileStem(base.contact.name)
    const resumePath = `${folder}/${stem}-Resume-${fileStem(job.company)}.docx`
    const letterPath = `${folder}/${stem}-Cover-Letter-${fileStem(job.company)}.docx`
    const now = new Date()
    const storage = supabase.storage.from(BUCKET)
    const pdfPath = (path: string) => path.replace(/\.docx$/, '.pdf')
    const files: Array<[string, Uint8Array<ArrayBuffer>, string]> = [
      [resumePath, await renderResume(resume), DOCX],
      [letterPath, await renderCoverLetter(base.contact, job, packet.cover_letter.paragraphs, now), DOCX],
      [pdfPath(resumePath), await renderResumePdf(resume), PDF],
      [pdfPath(letterPath), await renderCoverLetterPdf(base.contact, job, packet.cover_letter.paragraphs, now), PDF],
    ]
    for (const [path, bytes, type] of files) {
      const { error } = await storage.upload(path, new Blob([bytes], { type }), { upsert: true, contentType: type })
      if (error) throw error
    }

    // A yellow flag he already ticked stays ticked only if it's still about the same text.
    const before = new Map((row.check_flags as Flag[]).map((flag) => [flag.id, flag.text ?? '']))
    const acknowledged = (row.acknowledged_flags as string[]).filter((id) => check.flags.some((flag) => flag.id === id && (flag.text ?? '') === before.get(id)))

    const { data: updated, error: updateError } = await supabase
      .from('application_packets')
      .update({
        packet,
        revision,
        edited_at: now.toISOString(),
        resume_path: resumePath,
        cover_letter_path: letterPath,
        resume_pdf_path: pdfPath(resumePath),
        cover_letter_pdf_path: pdfPath(letterPath),
        resume_content: resume,
        cover_letter: packet.cover_letter.paragraphs.join('\n\n'),
        answers: Object.entries(ANSWER_QUESTIONS).map(([key, question]) => ({ key, question, answer: packet.answers[key as keyof typeof ANSWER_QUESTIONS] })),
        warnings,
        check_status: check.status,
        check_flags: check.flags,
        comparisons: check.comparisons,
        ats: check.ats,
        checked_at: now.toISOString(),
        acknowledged_flags: acknowledged,
        // An edited packet is a different packet: approve it again.
        approved_at: null,
      })
      .eq('id', row.id)
      .eq('revision', row.revision)
      .select('id')
    if (updateError) throw updateError
    if (!updated?.length) {
      await storage.remove(files.map(([path]) => path))
      return jsonResponse({ error: 'The packet changed while saving. Reload and edit again.' }, 409)
    }

    // The old files are no longer referenced. A failed removal only leaves an orphan in the private bucket.
    await storage.remove([row.resume_path, row.cover_letter_path, row.resume_pdf_path, row.cover_letter_pdf_path].filter((path): path is string => Boolean(path)))

    let voiceSaved = true
    if (applied.changes.length) {
      const { error } = await supabase.from('packet_edits').insert(applied.changes.map((change) => ({ user_id: userId, packet_id: row.id, job_id: job.id, revision, ...change })))
      voiceSaved = !error
    }

    return jsonResponse({ revision, check_status: check.status, changed_lines: applied.changes.length, voice_saved: voiceSaved })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
