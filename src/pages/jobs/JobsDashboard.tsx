import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import ConfirmDialog from './ConfirmDialog'
import JobFormDrawer from './JobFormDrawer'
import JobsTable, { type SortKey, type SortState } from './JobsTable'
import SummaryBar from './SummaryBar'
import Toolbar, { type JobFilters } from './Toolbar'
import { useJobs } from './useJobs'
import type { Job, JobUpdate } from './types'

type JobsDashboardProps = {
  session: Session
  signOut: () => Promise<void>
}

const initialFilters: JobFilters = {
  search: '',
  status: '',
  priority: '',
  job_type: '',
  work_mode: '',
  archive: 'active',
}

const searchableFields: (keyof Job)[] = [
  'company',
  'role_title',
  'location',
  'required_skills',
  'sponsorship_notes',
  'graduation_requirement',
  'e_verify_notes',
  'cover_letter_status',
  'recruiter_contact',
  'job_description',
  'notes',
]

const normalized = (value: string | number | boolean | null) => String(value ?? '').toLowerCase()

const compareValues = (left: string | number | boolean | null, right: string | number | boolean | null) => {
  const a = left ?? ''
  const b = right ?? ''
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

const JobsDashboard = ({ session, signOut }: JobsDashboardProps) => {
  const { jobs, loading, error, createJob, updateJob, archiveJob, deleteJob } = useJobs(session.user)
  const [filters, setFilters] = useState<JobFilters>(initialFilters)
  const [sort, setSort] = useState<SortState>({ key: 'date_found', direction: 'desc' })
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Job | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const visibleJobs = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return jobs
      .filter((job) => {
        if (filters.archive === 'active' && job.archived) return false
        if (filters.archive === 'archived' && !job.archived) return false
        if (filters.status && job.status !== filters.status) return false
        if (filters.priority && job.priority !== filters.priority) return false
        if (filters.job_type && job.job_type !== filters.job_type) return false
        if (filters.work_mode && job.work_mode !== filters.work_mode) return false
        if (!search) return true
        return searchableFields.some((field) => normalized(job[field]).includes(search))
      })
      .sort((left, right) => {
        const result = compareValues(left[sort.key], right[sort.key])
        return sort.direction === 'asc' ? result : -result
      })
  }, [filters, jobs, sort])

  const handleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const openCreate = () => {
    setEditingJob(null)
    setDrawerOpen(true)
  }

  const openEdit = (job: Job) => {
    setEditingJob(job)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingJob(null)
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setActionError(null)
    try {
      await archiveJob(archiveTarget.id, !archiveTarget.archived)
      setArchiveTarget(null)
    } catch (archiveError) {
      setActionError(archiveError instanceof Error ? archiveError.message : 'Unable to update archive state.')
    }
  }

  const handleUpdate = async (id: string, patch: JobUpdate) => {
    setActionError(null)
    try {
      await updateJob(id, patch)
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update job.'
      setActionError(message)
      throw updateError
    }
  }

  return (
    <main className="min-h-[calc(100vh-76px)] bg-slate-100 px-3 py-4 text-slate-800 sm:px-5">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Job pipeline</h1>
            <p className="text-sm text-slate-500">{session.user.email}</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 md:self-auto">
            Sign out
          </button>
        </header>

        <SummaryBar jobs={jobs} />
        <Toolbar filters={filters} onFiltersChange={setFilters} onAddJob={openCreate} />

        {(error || actionError) && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || actionError}</p>
        )}

        {loading ? (
          <section className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">Loading jobs...</section>
        ) : (
          <JobsTable
            jobs={visibleJobs}
            sort={sort}
            onSort={handleSort}
            onEdit={openEdit}
            onArchive={setArchiveTarget}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      {drawerOpen && (
        <JobFormDrawer
          job={editingJob}
          userId={session.user.id}
          onClose={closeDrawer}
          onCreate={createJob}
          onUpdate={async (id, payload) => updateJob(id, payload)}
          onDelete={deleteJob}
        />
      )}

      {archiveTarget && (
        <ConfirmDialog
          title={archiveTarget.archived ? 'Unarchive job?' : 'Archive job?'}
          message={
            archiveTarget.archived
              ? 'This returns the job to the active pipeline.'
              : 'This hides the job from the active pipeline without deleting it.'
          }
          confirmLabel={archiveTarget.archived ? 'Unarchive' : 'Archive'}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => void confirmArchive()}
        />
      )}
    </main>
  )
}

export default JobsDashboard
