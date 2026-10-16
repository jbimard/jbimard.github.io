// 'Queued' rows come from discovery and stay hidden until a batch promotes them to 'Found'
// (see supabase/migrations/20261016000000_daily_job_batch.sql).
export const STATUS_OPTIONS = [
  'Queued',
  'Found',
  'Fit Check',
  'Tailoring',
  'Ready to Apply',
  'Applied',
  'Follow-Up',
  'Interview',
  'Offer',
  'Rejected',
  'Closed',
] as const

// Statuses the dashboard shows and lets you pick; Queued is managed by the batch functions.
export const PIPELINE_STATUS_OPTIONS = STATUS_OPTIONS.filter((status) => status !== 'Queued')

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const
export const JOB_TYPE_OPTIONS = ['New Grad', 'Early Career', 'Rotational Program', 'Internship', 'Part-Time', 'Other'] as const
export const WORK_MODE_OPTIONS = ['Remote', 'Hybrid', 'Onsite', 'Unknown'] as const

export type JobStatus = (typeof STATUS_OPTIONS)[number]
export type JobPriority = (typeof PRIORITY_OPTIONS)[number]
export type JobType = (typeof JOB_TYPE_OPTIONS)[number]
export type WorkMode = (typeof WORK_MODE_OPTIONS)[number]

// Written by the Claude screening routine (automation/screening/results.ts, StoredScreening).
export interface Screening {
  score: number
  recommendation: 'apply' | 'maybe' | 'skip'
  reason: string
  strengths: string[]
  gaps: string[]
  resume_version: 'Cloud' | 'Security' | 'Cloud Security'
  checks: {
    sponsorship: {
      verdict: 'ok' | 'no_sponsorship' | 'unclear'
      note: string
      uscis: {
        employer: string | null
        fiscalYear: number | null
        count: number | null
        tier: 'strong' | 'some' | 'rare' | 'none'
        source: 'discovery' | 'corrected' | 'none'
      }
    }
    citizenship: { verdict: 'none' | 'required' | 'unclear'; note: string }
    clearance: { verdict: 'none' | 'conditional' | 'required'; note: string }
  }
  rule_score: number | null
  screened_by: string
}

export interface Job {
  id: string
  user_id: string
  company: string
  role_title: string
  location: string | null
  job_link: string | null
  status: JobStatus
  priority: JobPriority
  job_type: JobType | null
  work_mode: WorkMode
  match_score: number | null
  required_skills: string | null
  sponsorship_notes: string | null
  start_date: string | null
  graduation_requirement: string | null
  e_verify_notes: string | null
  cover_letter_status: string | null
  recruiter_contact: string | null
  job_description: string | null
  notes: string | null
  resume_version: string | null
  date_found: string | null
  date_applied: string | null
  follow_up_date: string | null
  archived: boolean
  screening: Screening | null
  screened_at: string | null
  created_at: string
  updated_at: string
}

export type JobDraft = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'screening' | 'screened_at'>
export type JobUpdate = Partial<Omit<Job, 'id' | 'created_at' | 'updated_at' | 'user_id'>>

export const EMPTY_JOB_VALUES = {
  company: '',
  role_title: '',
  location: '',
  job_link: '',
  status: 'Found' as JobStatus,
  priority: 'Medium' as JobPriority,
  job_type: '',
  work_mode: 'Unknown' as WorkMode,
  match_score: '',
  required_skills: '',
  sponsorship_notes: '',
  start_date: '',
  graduation_requirement: '',
  e_verify_notes: '',
  cover_letter_status: '',
  recruiter_contact: '',
  job_description: '',
  notes: '',
  resume_version: '',
  date_found: new Date().toISOString().slice(0, 10),
  date_applied: '',
  follow_up_date: '',
}

export type JobFormValues = typeof EMPTY_JOB_VALUES
