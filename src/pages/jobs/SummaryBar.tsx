import type { Job } from './types'

type SummaryBarProps = {
  jobs: Job[]
}

const today = new Date().toISOString().slice(0, 10)
const closedStatuses = new Set(['Rejected', 'Closed'])

const SummaryBar = ({ jobs }: SummaryBarProps) => {
  const active = jobs.filter((job) => !job.archived)
  const stats = [
    { label: 'Total active', value: active.length },
    { label: 'High priority', value: active.filter((job) => job.priority === 'High').length },
    { label: 'Ready to apply', value: active.filter((job) => job.status === 'Ready to Apply').length },
    { label: 'Applications submitted', value: active.filter((job) => Boolean(job.date_applied)).length },
    { label: 'Interviews', value: active.filter((job) => job.status === 'Interview').length },
    {
      label: 'Follow-ups due',
      value: active.filter((job) => job.follow_up_date && job.follow_up_date <= today && !closedStatuses.has(job.status)).length,
    },
  ]

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-md border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-normal text-slate-500">{stat.label}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{stat.value}</div>
        </div>
      ))}
    </section>
  )
}

export default SummaryBar
