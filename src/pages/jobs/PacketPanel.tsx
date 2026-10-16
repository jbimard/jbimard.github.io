import { useEffect, useRef, useState, type ReactNode } from 'react'
import ConfirmDialog from './ConfirmDialog'
import PacketEditor from './PacketEditor'
import { copyToClipboard } from './prompts'
import { CHECK_LABELS, type ApplicationPacket, type Job, type PacketEdit } from './types'

type PacketPanelProps = {
  job: Job
  packet: ApplicationPacket
  fileUrl: (path: string) => Promise<string>
  fileBlob: (path: string) => Promise<Blob>
  onApprove: (packetId: string, acknowledged: string[]) => Promise<void>
  onRegenerate: (packetId: string) => Promise<void>
  onEdit: (packetId: string, revision: number, edit: PacketEdit) => Promise<{ unchanged?: boolean; changed_lines?: number; voice_saved?: boolean }>
  onClose: () => void
}

type Tab = 'check' | 'resume' | 'changes' | 'letter' | 'edit'

const STATUS_CLASS: Record<ApplicationPacket['check_status'], string> = {
  pending: 'bg-slate-100 text-slate-600 ring-slate-200',
  pass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  needs_edits: 'bg-amber-50 text-amber-700 ring-amber-200',
  blocked: 'bg-red-50 text-red-700 ring-red-200',
}

// Qualification evidence that points at a whole resume section rather than a bullet.
const SECTION_LABELS: Record<string, string> = { summary: 'Summary', education: 'Education', skills: 'Skills', coursework: 'Relevant Coursework', certifications: 'Certifications' }

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-slate-200 pt-4">
    <h3 className="mb-2 text-sm font-semibold text-slate-950">{title}</h3>
    {children}
  </section>
)

// Renders the stored .docx itself (docx-preview, loaded only when this tab opens), so the preview is the exact file.
const ResumePreview = ({ path, fileBlob }: { path: string; fileBlob: (path: string) => Promise<Blob> }) => {
  const container = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | string>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [blob, { renderAsync }] = await Promise.all([fileBlob(path), import('docx-preview')])
        if (cancelled || !container.current) return
        container.current.innerHTML = ''
        await renderAsync(blob, container.current, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true })
        if (!cancelled) setState('ready')
      } catch (previewError) {
        if (!cancelled) setState(previewError instanceof Error ? previewError.message : 'Unable to load the preview.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, fileBlob])

  return (
    <div>
      {state === 'loading' && <p className="text-sm text-slate-500">Loading the resume file…</p>}
      {state !== 'loading' && state !== 'ready' && <p className="text-sm text-red-700">{state}</p>}
      <div ref={container} className="max-h-[70vh] overflow-auto rounded border border-slate-200 bg-slate-100" />
    </div>
  )
}

// Prepared application materials for one approved job (step 3b), with the Resume check (step 3c).
const PacketPanel = ({ job, packet, fileUrl, fileBlob, onApprove, onRegenerate, onEdit, onClose }: PacketPanelProps) => {
  const [tab, setTab] = useState<Tab>('check')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set(packet.acknowledged_flags))
  // A saved edit is a new revision with its own flags; start from what the server kept ticked.
  const [seenRevision, setSeenRevision] = useState(packet.revision)
  if (seenRevision !== packet.revision) {
    setSeenRevision(packet.revision)
    setAcknowledged(new Set(packet.acknowledged_flags))
  }

  const redFlags = packet.check_flags.filter((flag) => flag.severity === 'red')
  const yellowFlags = packet.check_flags.filter((flag) => flag.severity === 'yellow')
  const allAcknowledged = yellowFlags.every((flag) => acknowledged.has(flag.id))
  const canApprove = !packet.approved_at && (packet.check_status === 'pass' || (packet.check_status === 'needs_edits' && allAcknowledged))

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (label: string, text: string) => {
    await copyToClipboard(text)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }

  const download = (path: string) => run(async () => window.location.assign(await fileUrl(path)))

  const copyButton = (label: string, text: string) => (
    <button type="button" onClick={() => void copy(label, text)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
      {copied === label ? 'Copied' : 'Copy'}
    </button>
  )

  const toggle = (id: string) => setAcknowledged((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const report = packet.match_report
  const ats = packet.ats
  const qualifications = packet.packet?.qualifications ?? []
  const bulletText = new Map([...(packet.packet?.experience ?? []), ...(packet.packet?.projects ?? [])].flatMap((entry) => entry.bullets.map((bullet) => [bullet.from, bullet.text] as const)))
  const metCount = (kind: 'basic' | 'preferred') => `${qualifications.filter((q) => q.kind === kind && q.met).length} of ${qualifications.filter((q) => q.kind === kind).length}`
  const basicMissing = qualifications.filter((q) => q.kind === 'basic' && !q.met).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{job.company} — {job.role_title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_CLASS[packet.check_status]}`}>{CHECK_LABELS[packet.check_status]}</span>
              <span>{packet.resume_version} resume · prepared {packet.created_at.slice(0, 10)}{packet.edited_at ? ` · edited ${packet.edited_at.slice(0, 10)}` : ''}</span>
              {packet.approved_at && <span className="text-emerald-700">· Approved {packet.approved_at.slice(0, 10)}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">Close</button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canApprove || busy}
            onClick={() => void run(() => onApprove(packet.id, [...acknowledged]))}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {packet.approved_at ? 'Approved' : 'Approve'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmRegenerate(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Regenerate</button>
          <button type="button" onClick={() => void download(packet.resume_path)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Download resume</button>
          <button type="button" onClick={() => void download(packet.cover_letter_path)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Download cover letter</button>
          {packet.resume_pdf_path && (
            <button type="button" onClick={() => void download(packet.resume_pdf_path!)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Resume PDF</button>
          )}
          {packet.cover_letter_pdf_path && (
            <button type="button" onClick={() => void download(packet.cover_letter_pdf_path!)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Cover letter PDF</button>
          )}
        </div>
        {!packet.approved_at && packet.check_status === 'blocked' && (
          <p className="text-sm text-red-700">Blocked packets can't be approved. Regenerate it, and the next preparation run writes a new one.</p>
        )}
        {!packet.approved_at && packet.check_status === 'needs_edits' && !allAcknowledged && (
          <p className="text-sm text-amber-700">Tick each yellow flag under Check once you've read it to enable Approve.</p>
        )}
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <nav className="grid grid-cols-5 rounded-md border border-slate-300 p-1 text-sm">
          {([['check', 'Check'], ['resume', 'Resume'], ['changes', 'Changes'], ['letter', 'Letter & answers'], ['edit', 'Edit']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded px-2 py-1.5 ${tab === key ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'check' && (
          <div className="flex flex-col gap-4">
            <Section title="Estimated ATS score">
              {ats && ats.score !== null ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="text-2xl font-semibold text-slate-950">{ats.score}</span>
                    <span className="text-slate-500"> / 100 tailored · base resume {ats.base_score ?? '—'}</span>
                  </p>
                  <p><span className="font-medium">Required:</span> {ats.required.covered.join(', ') || '—'}{ats.required.missing.length > 0 && <span className="text-red-700"> · missing {ats.required.missing.join(', ')}</span>}</p>
                  <p><span className="font-medium">Preferred:</span> {ats.preferred.covered.join(', ') || '—'}{ats.preferred.missing.length > 0 && <span className="text-amber-700"> · missing {ats.preferred.missing.join(', ')}</span>}</p>
                  <p className="text-xs text-slate-500">Our estimate: posting keywords covered (required count double) plus format safety. Employers' real ATS rankings aren't visible to applicants.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Not enough tool or skill keywords in the posting to estimate.</p>
              )}
            </Section>

            <Section title={redFlags.length + yellowFlags.length === 0 ? 'No flags' : `Flags (${redFlags.length} red, ${yellowFlags.length} yellow)`}>
              <ul className="space-y-2 text-sm">
                {redFlags.map((flag) => (
                  <li key={flag.id} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    <p>{flag.message} <span className="text-xs text-red-600">({flag.path})</span></p>
                    {flag.text && <p className="mt-1 text-xs text-red-700">“{flag.text}”</p>}
                  </li>
                ))}
                {yellowFlags.map((flag) => (
                  <li key={flag.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" checked={acknowledged.has(flag.id)} disabled={Boolean(packet.approved_at)} onChange={() => toggle(flag.id)} />
                      <span>
                        {flag.message} <span className="text-xs text-amber-700">({flag.path})</span>
                        {flag.text && <span className="mt-1 block text-xs text-amber-800">“{flag.text}”</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>

            {qualifications.length > 0 && (
              <Section title={`Fit & gap · basic ${metCount('basic')} met · preferred ${metCount('preferred')} met`}>
                <p className="mb-2 text-xs text-slate-500">
                  Each qualification from the posting, judged against this resume the way per-qualification graders (Workday HiredScore) do. Basic ones weigh most{basicMissing > 0 ? `; ${basicMissing} unmet basic qualification${basicMissing === 1 ? '' : 's'} would likely lower the grade` : ''}. This is Claude's reading, with the lines it relies on.
                </p>
                <ul className="space-y-2 text-sm">
                  {qualifications.map((q, i) => (
                    <li key={i} className={`rounded border px-3 py-2 ${q.met ? 'border-emerald-200 bg-emerald-50' : q.kind === 'basic' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                      <p className="text-slate-800">
                        <span className={`mr-2 font-semibold ${q.met ? 'text-emerald-700' : 'text-red-700'}`}>{q.met ? 'Met' : 'Gap'}</span>
                        {q.text} <span className="text-xs text-slate-500">({q.kind})</span>
                      </p>
                      {q.evidence.map((ref) => (
                        <p key={ref} className="mt-1 text-xs text-slate-600">↳ {SECTION_LABELS[ref] ?? `“${bulletText.get(ref) ?? ref}”`}</p>
                      ))}
                      {q.note && <p className="mt-1 text-xs text-slate-600">{q.note}</p>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title={`Claude's match report · estimated coverage ${report.coverage}%`}>
              <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Covered:</span> {report.covered.join(', ') || '—'}</p>
              {report.gaps.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {report.gaps.map((gap) => (
                    <li key={gap.keyword}><span className="font-medium text-slate-800">{gap.keyword}</span> ({gap.addable ? 'in the base resumes, left out' : 'real gap'}): {gap.note}</li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {tab === 'edit' && (packet.packet
          ? <PacketEditor key={packet.revision} packet={packet} onSave={onEdit} />
          : <p className="text-sm text-slate-500">This packet was prepared before editing existed. Regenerate it, and the next preparation run writes one you can edit.</p>)}

        {tab === 'resume' && <ResumePreview path={packet.resume_path} fileBlob={fileBlob} />}

        {tab === 'changes' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">Each tailored bullet next to the base bullet it rewords. <span className="bg-red-100 line-through">Removed</span> and <span className="bg-emerald-100">added</span> words are highlighted.</p>
            {packet.comparisons.map((comparison) => (
              <div key={comparison.path} className="grid gap-2 rounded border border-slate-200 p-3 text-sm md:grid-cols-2">
                <p className="text-slate-500"><span className="block text-xs uppercase text-slate-400">Base</span>{comparison.source}</p>
                <p className="text-slate-800">
                  <span className="block text-xs uppercase text-slate-400">Tailored · {comparison.path}</span>
                  {comparison.diff.map(([op, words], i) => (
                    <span key={i} className={op === '+' ? 'bg-emerald-100' : op === '-' ? 'bg-red-100 text-slate-500 line-through' : ''}>{words} </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'letter' && (
          <div className="flex flex-col gap-4">
            <Section title="Cover letter">
              <div className="mb-2">{copyButton('cover letter', packet.cover_letter)}</div>
              <p className="whitespace-pre-line text-sm text-slate-700">{packet.cover_letter}</p>
            </Section>
            <Section title="Application answers">
              <div className="space-y-3">
                {packet.answers.filter((item) => item.answer.trim()).map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{item.question}</p>
                      {copyButton(item.key, item.answer)}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Work authorization (your fixed answers)">
              <div className="space-y-3">
                {packet.work_authorization.map((item) => (
                  <div key={item.question}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{item.question}</p>
                      {copyButton(item.question, item.answer)}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </aside>

      {confirmRegenerate && (
        // Keep clicks inside the dialog from reaching the panel's backdrop (which closes the panel).
        <div onClick={(event) => event.stopPropagation()}>
        <ConfirmDialog
          title="Regenerate this packet?"
          message="This deletes the packet. The job stays Ready to Apply, so the next preparation run (or Run now) writes a new one."
          confirmLabel="Regenerate"
          destructive
          onCancel={() => setConfirmRegenerate(false)}
          onConfirm={() => {
            setConfirmRegenerate(false)
            void run(async () => {
              await onRegenerate(packet.id)
              onClose()
            })
          }}
        />
        </div>
      )}
    </div>
  )
}

export default PacketPanel
