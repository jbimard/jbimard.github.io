import { JOB_TYPE_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS, WORK_MODE_OPTIONS, type JobPriority, type JobStatus, type JobType, type WorkMode } from './types'

export type ArchiveFilter = 'active' | 'archived' | 'all'

export type JobFilters = {
  search: string
  status: JobStatus | ''
  priority: JobPriority | ''
  job_type: JobType | ''
  work_mode: WorkMode | ''
  archive: ArchiveFilter
}

type ToolbarProps = {
  filters: JobFilters
  onFiltersChange: (filters: JobFilters) => void
  onAddJob: () => void
}

const Toolbar = ({ filters, onFiltersChange, onAddJob }: ToolbarProps) => {
  const setFilter = <Key extends keyof JobFilters>(key: Key, value: JobFilters[Key]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        <input
          type="search"
          placeholder="Search jobs"
          value={filters.search}
          onChange={(event) => setFilter('search', event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
        />
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value as JobFilters['status'])} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value as JobFilters['priority'])} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select value={filters.job_type} onChange={(event) => setFilter('job_type', event.target.value as JobFilters['job_type'])} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All job types</option>
          {JOB_TYPE_OPTIONS.map((jobType) => <option key={jobType} value={jobType}>{jobType}</option>)}
        </select>
        <select value={filters.work_mode} onChange={(event) => setFilter('work_mode', event.target.value as JobFilters['work_mode'])} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All work modes</option>
          {WORK_MODE_OPTIONS.map((workMode) => <option key={workMode} value={workMode}>{workMode}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid grid-cols-3 rounded-md border border-slate-300 p-1 text-sm">
          {(['active', 'archived', 'all'] as ArchiveFilter[]).map((archive) => (
            <button
              key={archive}
              type="button"
              onClick={() => setFilter('archive', archive)}
              className={`rounded px-3 py-2 capitalize ${filters.archive === archive ? 'bg-slate-950 text-white' : 'text-slate-600'}`}
            >
              {archive}
            </button>
          ))}
        </div>
        <button type="button" onClick={onAddJob} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + Add Job
        </button>
      </div>
    </section>
  )
}

export default Toolbar
