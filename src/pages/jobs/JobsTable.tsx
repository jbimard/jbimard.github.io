import JobRow from './JobRow'
import type { Job, JobUpdate } from './types'

export type SortKey = 'company' | 'role_title' | 'priority' | 'status' | 'match_score' | 'date_found' | 'date_applied' | 'follow_up_date'
export type SortState = { key: SortKey; direction: 'asc' | 'desc' }

type JobsTableProps = {
  jobs: Job[]
  sort: SortState
  onSort: (key: SortKey) => void
  onEdit: (job: Job) => void
  onArchive: (job: Job) => void
  onUpdate: (id: string, patch: JobUpdate) => Promise<void>
}

const columns: { key: SortKey; label: string; align?: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role_title', label: 'Role' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'match_score', label: 'Match', align: 'text-right' },
  { key: 'date_found', label: 'Found' },
  { key: 'date_applied', label: 'Applied' },
  { key: 'follow_up_date', label: 'Follow-up' },
]

const JobsTable = ({ jobs, sort, onSort, onEdit, onArchive, onUpdate }: JobsTableProps) => (
  <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
          <tr>
            {columns.slice(0, 2).map((column) => (
              <th key={column.key} className="border-b border-slate-200 px-3 py-2">
                <button type="button" onClick={() => onSort(column.key)} className="font-semibold hover:text-slate-950">
                  {column.label} {sort.key === column.key ? `(${sort.direction})` : ''}
                </button>
              </th>
            ))}
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Location</th>
            {columns.slice(2).map((column) => (
              <th key={column.key} className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 ${column.align ?? ''}`}>
                <button type="button" onClick={() => onSort(column.key)} className="font-semibold hover:text-slate-950">
                  {column.label} {sort.key === column.key ? `(${sort.direction})` : ''}
                </button>
              </th>
            ))}
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => <JobRow key={job.id} job={job} onEdit={onEdit} onArchive={onArchive} onUpdate={onUpdate} />)}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-500">No jobs match the current view.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
)

export default JobsTable
