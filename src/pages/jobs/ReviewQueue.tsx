import { useEffect, useState } from 'react'
import type { Job, Screening } from './types'

export type ReviewDecision = 'approve' | 'reject' | 'later'

type ReviewQueueProps = {
  jobs: Job[]
  onDecide: (job: Job, decision: ReviewDecision) => Promise<void>
}

const recommendationClass: Record<Screening['recommendation'], string> = {
  apply: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  maybe: 'bg-amber-50 text-amber-700 ring-amber-200',
  skip: 'bg-slate-100 text-slate-600 ring-slate-200',
}

// Warning when a check could block or cost the application.
const checkWarns = (checks: Screening['checks']) => ({
  sponsorship: checks.sponsorship.verdict !== 'ok',
  citizenship: checks.citizenship.verdict !== 'none',
  clearance: checks.clearance.verdict !== 'none',
})

const uscisLine = ({ uscis }: Screening['checks']['sponsorship']) => {
  if (uscis.source === 'none' || uscis.count === null) return 'USCIS: no H-1B record found'
  const year = uscis.fiscalYear ? ` in FY${uscis.fiscalYear}` : ''
  return `USCIS: ${uscis.count.toLocaleString('en-US')} new-employment H-1B approvals${year} (${uscis.tier})${uscis.source === 'corrected' ? ' · match corrected by Claude' : ''}`
}

const isTyping = (target: EventTarget | null) => (
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
)

const ReviewCard = ({ job, active, busy, onSelect, onDecide }: {
  job: Job
  active: boolean
  busy: boolean
  onSelect: () => void
  onDecide: (decision: ReviewDecision) => void
}) => {
  const screening = job.screening as Screening
  const warns = checkWarns(screening.checks)
  const checks = [
    { label: 'Sponsorship', verdict: screening.checks.sponsorship.verdict, note: screening.checks.sponsorship.note, warn: warns.sponsorship },
    { label: 'Citizenship', verdict: screening.checks.citizenship.verdict, note: screening.checks.citizenship.note, warn: warns.citizenship },
    { label: 'Clearance', verdict: screening.checks.clearance.verdict, note: screening.checks.clearance.note, warn: warns.clearance },
  ]

  return (
    <article
      onClick={onSelect}
      className={`rounded-md border bg-white p-4 ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
    >
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{job.company} — {job.role_title}</h2>
          <p className="text-sm text-slate-500">
            {[job.location, job.job_type, job.work_mode !== 'Unknown' ? job.work_mode : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded px-2 py-1 text-xs font-medium uppercase ring-1 ${recommendationClass[screening.recommendation]}`}>{screening.recommendation}</span>
          <span className="font-semibold text-slate-950">{screening.score}</span>
          <span className="text-xs text-slate-500">rule {screening.rule_score ?? '—'}</span>
        </div>
      </header>

      <p className="mt-3 text-sm text-slate-800">{screening.reason}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-xs uppercase text-slate-500">Strengths</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {screening.strengths.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase text-slate-500">Gaps</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {screening.gaps.length > 0 ? screening.gaps.map((item) => <li key={item}>{item}</li>) : <li>None noted</li>}
          </ul>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className={`rounded border px-3 py-2 ${check.warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <dt className="text-xs uppercase text-slate-500">{check.warn ? '⚠ ' : ''}{check.label}: {check.verdict.replace('_', ' ')}</dt>
            <dd className="mt-1 text-slate-700">{check.note}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-slate-500">{uscisLine(screening.checks.sponsorship)}</p>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs text-slate-500">Resume: {screening.resume_version}</span>
        {job.job_link && (
          <a href={job.job_link} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Posting ↗
          </a>
        )}
        <button type="button" disabled={busy} onClick={() => onDecide('later')} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
          Later (l)
        </button>
        <button type="button" disabled={busy} onClick={() => onDecide('reject')} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
          Reject (r)
        </button>
        <button type="button" disabled={busy} onClick={() => onDecide('approve')} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          Approve (a)
        </button>
      </footer>
    </article>
  )
}

const ReviewQueue = ({ jobs, onDecide }: ReviewQueueProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // "Later" keeps the job in Fit Check but moves it to the back for this visit.
  const [deferred, setDeferred] = useState<string[]>([])

  const ordered = [...jobs].sort((a, b) => Number(deferred.includes(a.id)) - Number(deferred.includes(b.id)))
  const activeIndex = Math.max(0, ordered.findIndex((job) => job.id === activeId))
  const active = ordered[activeIndex] ?? null

  const decide = async (job: Job, decision: ReviewDecision) => {
    if (decision === 'later') {
      setDeferred((current) => [...current.filter((id) => id !== job.id), job.id])
      setActiveId(ordered[activeIndex + 1]?.id ?? null)
      return
    }
    setBusyId(job.id)
    try {
      await onDecide(job, decision)
      setActiveId(ordered[activeIndex + 1]?.id ?? null)
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || !active || busyId) return
      const key = event.key.toLowerCase()
      if (key === 'j') setActiveId(ordered[Math.min(activeIndex + 1, ordered.length - 1)]?.id ?? null)
      else if (key === 'k') setActiveId(ordered[Math.max(activeIndex - 1, 0)]?.id ?? null)
      else if (key === 'a') void decide(active, 'approve')
      else if (key === 'r') void decide(active, 'reject')
      else if (key === 'l') void decide(active, 'later')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (ordered.length === 0) {
    return (
      <section className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Nothing to review. Screened jobs appear here after the morning routine runs.
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        {ordered.length} to review · Approve moves to Ready to Apply · Reject archives · keys: j/k move, a approve, r reject, l later
      </p>
      {ordered.map((job) => (
        <ReviewCard
          key={job.id}
          job={job}
          active={job.id === active?.id}
          busy={busyId === job.id}
          onSelect={() => setActiveId(job.id)}
          onDecide={(decision) => void decide(job, decision)}
        />
      ))}
    </section>
  )
}

export default ReviewQueue
