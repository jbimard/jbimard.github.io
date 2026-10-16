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
  // Closed-posting check (automation/links/strikes.ts); two "missing" checks on different days close the job.
  link_status: 'open' | 'missing' | 'unverified' | null
  link_missing_count: number
  link_checked_at: string | null
  created_at: string
  updated_at: string
}

// Written by the job-prep Edge Function (automation/prep/packet.ts); read-only in the dashboard.
export interface ApplicationPacket {
  id: string
  job_id: string
  resume_version: 'Cloud' | 'Security' | 'Cloud Security'
  resume_path: string
  cover_letter_path: string
  cover_letter: string
  answers: Array<{ key: string; question: string; answer: string }>
  work_authorization: Array<{ question: string; answer: string }>
  match_report: { coverage: number; covered: string[]; gaps: Array<{ keyword: string; addable: boolean; note: string }> }
  warnings: Array<{ path: string; message: string }>
  // Resume check (automation/prep/check.ts): red flags block approval, yellow ones must be acknowledged.
  check_status: 'pending' | 'pass' | 'needs_edits' | 'blocked'
  check_flags: Array<{ id: string; severity: 'red' | 'yellow'; rule: string; path: string; message: string; text?: string }>
  comparisons: Array<{ path: string; source: string; text: string; diff: Array<['=' | '-' | '+', string]> }>
  ats: {
    score: number | null
    base_score: number | null
    required: { covered: string[]; missing: string[] }
    preferred: { covered: string[]; missing: string[] }
  } | null
  checked_at: string | null
  acknowledged_flags: string[]
  approved_at: string | null
  created_at: string
}

export const CHECK_LABELS: Record<ApplicationPacket['check_status'], string> = {
  pending: 'Not checked',
  pass: 'Pass',
  needs_edits: 'Needs edits',
  blocked: 'Blocked',
}

export type JobDraft = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'screening' | 'screened_at' | 'link_status' | 'link_missing_count' | 'link_checked_at'>
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
