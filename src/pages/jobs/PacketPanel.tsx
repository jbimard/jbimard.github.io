import { useState, type ReactNode } from 'react'
import { copyToClipboard } from './prompts'
import type { ApplicationPacket, Job } from './types'

type PacketPanelProps = {
  job: Job
  packet: ApplicationPacket
  fileUrl: (path: string) => Promise<string>
  onClose: () => void
}

const CHECK_LABELS: Record<ApplicationPacket['check_status'], string> = {
  pending: 'Not checked yet (Resume check comes in step 3c)',
  pass: 'Pass',
  needs_edits: 'Needs edits',
  blocked: 'Blocked',
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-slate-200 pt-4">
    <h3 className="mb-2 text-sm font-semibold text-slate-950">{title}</h3>
    {children}
  </section>
)

// Prepared application materials for one approved job (written by the job-prep routine, step 3b).
const PacketPanel = ({ job, packet, fileUrl, onClose }: PacketPanelProps) => {
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const copy = async (label: string, text: string) => {
    await copyToClipboard(text)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }

  const download = async (path: string) => {
    setError(null)
    try {
      window.location.assign(await fileUrl(path))
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to open the file.')
    }
  }

  const copyButton = (label: string, text: string) => (
    <button type="button" onClick={() => void copy(label, text)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
      {copied === label ? 'Copied' : 'Copy'}
    </button>
  )

  const report = packet.match_report

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{job.company} — {job.role_title}</h2>
            <p className="text-sm text-slate-500">{packet.resume_version} resume · prepared {packet.created_at.slice(0, 10)} · {CHECK_LABELS[packet.check_status]}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">Close</button>
        </header>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void download(packet.resume_path)} className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white hover:bg-slate-800">Download resume (.docx)</button>
          <button type="button" onClick={() => void download(packet.cover_letter_path)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Download cover letter (.docx)</button>
        </div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Section title={`Match report · estimated coverage ${report.coverage}%`}>
          <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Covered:</span> {report.covered.join(', ') || '—'}</p>
          {report.gaps.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {report.gaps.map((gap) => (
                <li key={gap.keyword}>
                  <span className="font-medium text-slate-800">{gap.keyword}</span>
                  {' '}({gap.addable ? 'in the base resumes, left out' : 'real gap'}): {gap.note}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {packet.warnings.length > 0 && (
          <Section title="Warnings">
            <ul className="space-y-1 text-sm text-amber-700">
              {packet.warnings.map((warning) => <li key={`${warning.path}-${warning.message}`}>{warning.path}: {warning.message}</li>)}
            </ul>
          </Section>
        )}

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
      </aside>
    </div>
  )
}

export default PacketPanel
