import { useState, type FormEvent } from 'react'
import { daysBetween, milestones, nextMilestone, unemployment, watchList, type Milestone, type MilestoneState, type VisaProfile } from './visaTimeline'

type VisaTimelineCardProps = {
  profile: VisaProfile | null
  loading: boolean
  error: string | null
  onSave: (values: VisaProfile) => Promise<void>
}

type FormValues = Record<'program_end_date' | 'opt_start_date' | 'opt_end_date' | 'stem_opt_end_date' | 'unemployed_since' | 'unemployed_days_logged', string>

const OPEN_KEY = 'jobs.visaTimeline.open'

// Local calendar date, so windows flip at the user's midnight rather than UTC's.
const localToday = () => new Date().toLocaleDateString('en-CA')

const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const inDays = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`)

const stateClass: Record<MilestoneState, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  upcoming: 'bg-sky-50 text-sky-700 ring-sky-200',
  done: 'bg-slate-100 text-slate-600 ring-slate-200',
  past: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

const nextLine = (item: Milestone, today: string) => {
  if (item.state === 'open' && item.end) return `${item.title}: open now, closes ${formatDate(item.end)} (${inDays(daysBetween(today, item.end))})`
  return `${item.title}: ${item.end ? 'opens' : 'on'} ${formatDate(item.start)} (${inDays(daysBetween(today, item.start))})`
}

const toForm = (profile: VisaProfile | null): FormValues => ({
  program_end_date: profile?.program_end_date ?? '',
  opt_start_date: profile?.opt_start_date ?? '',
  opt_end_date: profile?.opt_end_date ?? '',
  stem_opt_end_date: profile?.stem_opt_end_date ?? '',
  unemployed_since: profile?.unemployed_since ?? '',
  unemployed_days_logged: String(profile?.unemployed_days_logged ?? 0),
})

const dateFields: { key: Exclude<keyof FormValues, 'unemployed_days_logged'>; label: string; hint: string }[] = [
  { key: 'program_end_date', label: 'Program end date', hint: 'From the I-20.' },
  { key: 'opt_start_date', label: 'OPT start date', hint: 'From the OPT EAD card, once approved.' },
  { key: 'opt_end_date', label: 'OPT end date', hint: 'From the OPT EAD card.' },
  { key: 'stem_opt_end_date', label: 'STEM OPT end date', hint: 'From the STEM OPT EAD card.' },
  { key: 'unemployed_since', label: 'Not working since', hint: 'Blank while working. Before the first job, use the OPT start date.' },
]

const VisaDatesForm = ({ initial, onSave, onCancel }: {
  initial: VisaProfile | null
  onSave: (values: VisaProfile) => Promise<void>
  onCancel: (() => void) | null
}) => {
  const [values, setValues] = useState<FormValues>(toForm(initial))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const logged = Number(values.unemployed_days_logged || 0)
    if (!Number.isInteger(logged) || logged < 0 || logged > 365) {
      setFormError('Earlier unemployed days must be a whole number from 0 to 365.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        program_end_date: values.program_end_date,
        opt_start_date: values.opt_start_date || null,
        opt_end_date: values.opt_end_date || null,
        stem_opt_end_date: values.stem_opt_end_date || null,
        unemployed_since: values.unemployed_since || null,
        unemployed_days_logged: logged,
      })
      onCancel?.()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save the dates.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-500">Dates only. Never enter document numbers (SEVIS ID, A-number, EAD card or receipt numbers).</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dateFields.map((field) => (
          <label key={field.key} className="block text-sm font-medium text-slate-700">
            {field.label}
            <input
              type="date"
              required={field.key === 'program_end_date'}
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">{field.hint}</span>
          </label>
        ))}
        <label className="block text-sm font-medium text-slate-700">
          Unemployed days from earlier gaps
          <input
            type="number"
            min={0}
            max={365}
            value={values.unemployed_days_logged}
            onChange={(event) => setValues((current) => ({ ...current, unemployed_days_logged: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">When a gap ends, add its days here and clear "Not working since".</span>
        </label>
      </div>
      {formError && <p className="mt-2 text-sm text-red-700">{formError}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Save dates'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
        )}
      </div>
    </form>
  )
}

const VisaTimelineCard = ({ profile, loading, error, onSave }: VisaTimelineCardProps) => {
  const [open, setOpen] = useState(readOpen)
  const [editing, setEditing] = useState(false)
  const today = localToday()

  const toggleOpen = () => {
    setOpen((current) => {
      try {
        localStorage.setItem(OPEN_KEY, current ? '0' : '1')
      } catch {
        // Remembering the choice is a convenience only.
      }
      return !current
    })
  }

  if (loading) return null

  if (error) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Visa timeline: {error}</p>
  }

  if (!profile) {
    return (
      <section className="rounded-md border border-slate-200 bg-white px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">My timeline</h2>
        <p className="text-sm text-slate-500">Enter the program end date to see the OPT, STEM OPT and H-1B dates worked out from it.</p>
        <VisaDatesForm initial={null} onSave={onSave} onCancel={null} />
      </section>
    )
  }

  const list = milestones(profile, today)
  const next = nextMilestone(list)
  const clock = unemployment(profile, today)
  const watch = watchList(today)

  return (
    <section className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">My timeline</h2>
          <p className="text-sm text-slate-800">{next ? `Next: ${nextLine(next, today)}` : 'No upcoming dates.'}</p>
          <p className="text-sm text-slate-600">
            {clock.started
              ? `Unemployment: ${clock.used} of ${clock.limit} days used, ${clock.left} left${clock.runsOut ? ` (runs out ${formatDate(clock.runsOut)} if still not working)` : ''}`
              : `Unemployment: the clock starts on the OPT start date (limit ${clock.limit} days, 150 with STEM OPT)`}
          </p>
          <p className="text-sm text-amber-700">⚠ {watch[0].title}: {watch[0].status}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing((current) => !current)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Edit dates
          </button>
          <button type="button" onClick={toggleOpen} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            {open ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </header>

      {editing && <VisaDatesForm initial={profile} onSave={onSave} onCancel={() => setEditing(false)} />}

      {open && (
        <div className="mt-3 grid gap-4 border-t border-slate-200 pt-3 lg:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase text-slate-500">Dates</h3>
            <ol className="mt-1 space-y-2">
              {list.map((item) => (
                <li key={item.key} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ring-1 ${stateClass[item.state]}`}>{item.state}</span>
                    <span className="font-medium text-slate-950">{item.title}</span>
                    <span className="text-slate-600">
                      {formatDate(item.start)}{item.end ? ` – ${formatDate(item.end)}` : ''}{item.estimated ? ' (estimated)' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.note}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-xs uppercase text-slate-500">Rules to watch</h3>
            <ul className="mt-1 space-y-2">
              {watch.map((item) => (
                <li key={item.key} className="text-sm">
                  <a href={item.link} target="_blank" rel="noreferrer" className="font-medium text-slate-950 underline">{item.title}</a>
                  <p className="text-slate-700">{item.status}</p>
                  <p className="text-xs text-slate-500">{item.impact} Checked {formatDate(item.checked)}.</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              A reminder tool, not legal advice. Confirm every date with the school's DSO before filing.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default VisaTimelineCard
