import { useState } from 'react'
import { buildChatGptPrompt, buildClaudePrompt, copyToClipboard } from './prompts'
import { PRIORITY_OPTIONS, STATUS_OPTIONS, type Job, type JobPriority, type JobStatus, type JobUpdate } from './types'

type JobRowProps = {
  job: Job
  onEdit: (job: Job) => void
  onArchive: (job: Job) => void
  onUpdate: (id: string, patch: JobUpdate) => Promise<void>
}

const statusClass = (status: JobStatus) => {
  if (status === 'Interview' || status === 'Offer') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === 'Rejected' || status === 'Closed') return 'bg-slate-100 text-slate-600 ring-slate-200'
  if (status === 'Ready to Apply' || status === 'Follow-Up') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-sky-50 text-sky-700 ring-sky-200'
}

const priorityClass = (priority: JobPriority) => {
  if (priority === 'High') return 'bg-red-50 text-red-700 ring-red-200'
  if (priority === 'Low') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-indigo-50 text-indigo-700 ring-indigo-200'
}

const Badge = ({ children, className }: { children: string; className: string }) => (
  <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ring-1 ${className}`}>{children}</span>
)

const JobRow = ({ job, onEdit, onArchive, onUpdate }: JobRowProps) => {
  const [copied, setCopied] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingPriority, setEditingPriority] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)

  const updateInline = async (patch: JobUpdate) => {
    setSaving(true)
    try {
      await onUpdate(job.id, patch)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (status: JobStatus) => {
    const patch: JobUpdate = { status }
    const today = new Date().toISOString().slice(0, 10)
    if (status === 'Applied' && !job.date_applied) patch.date_applied = today
    if (status === 'Follow-Up' && !job.follow_up_date) patch.follow_up_date = today
    await updateInline(patch)
  }

  const copyPrompt = async (label: 'Claude' | 'ChatGPT') => {
    await copyToClipboard(label === 'Claude' ? buildClaudePrompt(job) : buildChatGptPrompt(job))
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <tr className={job.archived ? 'bg-slate-50 text-slate-500' : 'bg-white'}>
      <td className="border-b border-slate-200 px-3 py-2 font-medium text-slate-950">{job.company}</td>
      <td className="border-b border-slate-200 px-3 py-2">{job.role_title}</td>
      <td className="border-b border-slate-200 px-3 py-2">{job.location || '-'}</td>
      <td className="border-b border-slate-200 px-3 py-2">
        {editingPriority ? (
          <select
            autoFocus
            value={job.priority}
            disabled={saving}
            onChange={(event) => {
              void updateInline({ priority: event.target.value as JobPriority })
              setEditingPriority(false)
            }}
            onBlur={() => setEditingPriority(false)}
            className="w-full min-w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setEditingPriority(true)}>
            <Badge className={priorityClass(job.priority)}>{job.priority}</Badge>
          </button>
        )}
      </td>
      <td className="border-b border-slate-200 px-3 py-2">
        {editingStatus ? (
          <select
            autoFocus
            value={job.status}
            disabled={saving}
            onChange={(event) => {
              void updateStatus(event.target.value as JobStatus)
              setEditingStatus(false)
            }}
            onBlur={() => setEditingStatus(false)}
            className="w-full min-w-36 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setEditingStatus(true)}>
            <Badge className={statusClass(job.status)}>{job.status}</Badge>
          </button>
        )}
      </td>
      <td className="border-b border-slate-200 px-3 py-2 text-right">{job.match_score ?? '-'}</td>
      <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2">{job.date_found || '-'}</td>
      <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2">{job.date_applied || '-'}</td>
      <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2">{job.follow_up_date || '-'}</td>
      <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2">
        <div className="flex flex-nowrap items-center gap-1">
          <button type="button" onClick={() => onEdit(job)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
          {job.job_link && (
            <a href={job.job_link} target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Open</a>
          )}
          <button type="button" onClick={() => void copyPrompt('Claude')} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Claude</button>
          <button type="button" onClick={() => void copyPrompt('ChatGPT')} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">ChatGPT</button>
          <button type="button" onClick={() => onArchive(job)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            {job.archived ? 'Unarchive' : 'Archive'}
          </button>
          {copied && <span className="text-xs text-emerald-700">Copied {copied}</span>}
        </div>
      </td>
    </tr>
  )
}

export default JobRow
