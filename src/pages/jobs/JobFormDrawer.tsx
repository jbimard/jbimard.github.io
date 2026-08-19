import { useMemo, useState, type FormEvent } from 'react'
import ConfirmDialog from './ConfirmDialog'
import {
  EMPTY_JOB_VALUES,
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  type Job,
  type JobDraft,
  type JobFormValues,
} from './types'

type JobFormDrawerProps = {
  job: Job | null
  userId: string
  onClose: () => void
  onCreate: (job: Omit<JobDraft, 'user_id'>) => Promise<void>
  onUpdate: (id: string, job: Omit<JobDraft, 'user_id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const textFields: { key: keyof JobFormValues; label: string; type?: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role_title', label: 'Role title' },
  { key: 'location', label: 'Location' },
  { key: 'job_link', label: 'Job link', type: 'url' },
  { key: 'resume_version', label: 'Resume version label' },
  { key: 'start_date', label: 'Start date', type: 'date' },
  { key: 'date_found', label: 'Date found', type: 'date' },
  { key: 'date_applied', label: 'Date applied', type: 'date' },
  { key: 'follow_up_date', label: 'Follow-up date', type: 'date' },
]

const textAreas: { key: keyof JobFormValues; label: string; rows: number }[] = [
  { key: 'required_skills', label: 'Required skills', rows: 3 },
  { key: 'sponsorship_notes', label: 'Sponsorship notes', rows: 3 },
  { key: 'graduation_requirement', label: 'Graduation requirement', rows: 3 },
  { key: 'e_verify_notes', label: 'E-Verify notes', rows: 3 },
  { key: 'cover_letter_status', label: 'Cover letter status', rows: 3 },
  { key: 'recruiter_contact', label: 'Recruiter contact', rows: 3 },
  { key: 'job_description', label: 'Job description', rows: 7 },
  { key: 'notes', label: 'Notes', rows: 4 },
]

const toFormValues = (job: Job | null): JobFormValues => {
  if (!job) return EMPTY_JOB_VALUES

  return {
    company: job.company,
    role_title: job.role_title,
    location: job.location ?? '',
    job_link: job.job_link ?? '',
    status: job.status,
    priority: job.priority,
    job_type: job.job_type ?? '',
    work_mode: job.work_mode,
    match_score: job.match_score === null ? '' : String(job.match_score),
    required_skills: job.required_skills ?? '',
    sponsorship_notes: job.sponsorship_notes ?? '',
    start_date: job.start_date ?? '',
    graduation_requirement: job.graduation_requirement ?? '',
    e_verify_notes: job.e_verify_notes ?? '',
    cover_letter_status: job.cover_letter_status ?? '',
    recruiter_contact: job.recruiter_contact ?? '',
    job_description: job.job_description ?? '',
    notes: job.notes ?? '',
    resume_version: job.resume_version ?? '',
    date_found: job.date_found ?? '',
    date_applied: job.date_applied ?? '',
    follow_up_date: job.follow_up_date ?? '',
  }
}

const optional = (value: string) => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const toDraft = (values: JobFormValues, userId: string): JobDraft => ({
  user_id: userId,
  company: values.company.trim(),
  role_title: values.role_title.trim(),
  location: optional(values.location),
  job_link: optional(values.job_link),
  status: values.status,
  priority: values.priority,
  job_type: values.job_type === '' ? null : values.job_type as JobDraft['job_type'],
  work_mode: values.work_mode,
  match_score: values.match_score === '' ? null : Number(values.match_score),
  required_skills: optional(values.required_skills),
  sponsorship_notes: optional(values.sponsorship_notes),
  start_date: optional(values.start_date),
  graduation_requirement: optional(values.graduation_requirement),
  e_verify_notes: optional(values.e_verify_notes),
  cover_letter_status: optional(values.cover_letter_status),
  recruiter_contact: optional(values.recruiter_contact),
  job_description: optional(values.job_description),
  notes: optional(values.notes),
  resume_version: optional(values.resume_version),
  date_found: optional(values.date_found),
  date_applied: optional(values.date_applied),
  follow_up_date: optional(values.follow_up_date),
  archived: false,
})

const JobFormDrawer = ({ job, userId, onClose, onCreate, onUpdate, onDelete }: JobFormDrawerProps) => {
  const initialValues = useMemo(() => toFormValues(job), [job])
  const [values, setValues] = useState<JobFormValues>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setValue = <Key extends keyof JobFormValues>(key: Key, value: JobFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const draft = toDraft(values, userId)
      const payload = {
        company: draft.company,
        role_title: draft.role_title,
        location: draft.location,
        job_link: draft.job_link,
        status: draft.status,
        priority: draft.priority,
        job_type: draft.job_type,
        work_mode: draft.work_mode,
        match_score: draft.match_score,
        required_skills: draft.required_skills,
        sponsorship_notes: draft.sponsorship_notes,
        start_date: draft.start_date,
        graduation_requirement: draft.graduation_requirement,
        e_verify_notes: draft.e_verify_notes,
        cover_letter_status: draft.cover_letter_status,
        recruiter_contact: draft.recruiter_contact,
        job_description: draft.job_description,
        notes: draft.notes,
        resume_version: draft.resume_version,
        date_found: draft.date_found,
        date_applied: draft.date_applied,
        follow_up_date: draft.follow_up_date,
        archived: draft.archived,
      }
      if (job) {
        await onUpdate(job.id, { ...payload, archived: job.archived })
      } else {
        await onCreate(payload)
      }
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save job.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!job) return
    setSubmitting(true)
    try {
      await onDelete(job.id)
      onClose()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete job.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{job ? 'Edit job' : 'Add job'}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Close</button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            {textFields.map((field) => (
              <label key={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
                <input
                  type={field.type ?? 'text'}
                  required={field.key === 'company' || field.key === 'role_title'}
                  value={values[field.key]}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
                />
              </label>
            ))}

            <label className="block text-sm font-medium text-slate-700">
              Status
              <select value={values.status} onChange={(event) => setValue('status', event.target.value as JobFormValues['status'])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Priority
              <select value={values.priority} onChange={(event) => setValue('priority', event.target.value as JobFormValues['priority'])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Job type
              <select value={values.job_type} onChange={(event) => setValue('job_type', event.target.value as JobFormValues['job_type'])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Not set</option>
                {JOB_TYPE_OPTIONS.map((jobType) => <option key={jobType} value={jobType}>{jobType}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Work mode
              <select value={values.work_mode} onChange={(event) => setValue('work_mode', event.target.value as JobFormValues['work_mode'])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {WORK_MODE_OPTIONS.map((workMode) => <option key={workMode} value={workMode}>{workMode}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Match score
              <input
                type="number"
                min="0"
                max="100"
                value={values.match_score}
                onChange={(event) => setValue('match_score', event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
              />
            </label>
          </div>

          <div className="mt-4 space-y-4">
            {textAreas.map((field) => (
              <label key={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
                <textarea
                  rows={field.rows}
                  value={values[field.key]}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
                />
              </label>
            ))}
          </div>

          {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <footer className="sticky bottom-0 mt-6 border-t border-slate-200 bg-white py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {job ? (
                <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                  Delete permanently
                </button>
              ) : <span />}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                  {submitting ? 'Saving...' : 'Save job'}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </aside>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete job permanently?"
          message="This removes the record from Supabase. Archive the job instead if you may need it later."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  )
}

export default JobFormDrawer
