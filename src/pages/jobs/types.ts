export const STATUS_OPTIONS = [
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

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const
export const JOB_TYPE_OPTIONS = ['New Grad', 'Early Career', 'Rotational Program', 'Internship', 'Part-Time', 'Other'] as const
export const WORK_MODE_OPTIONS = ['Remote', 'Hybrid', 'Onsite', 'Unknown'] as const

export type JobStatus = (typeof STATUS_OPTIONS)[number]
export type JobPriority = (typeof PRIORITY_OPTIONS)[number]
export type JobType = (typeof JOB_TYPE_OPTIONS)[number]
export type WorkMode = (typeof WORK_MODE_OPTIONS)[number]

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
  created_at: string
  updated_at: string
}

export type JobDraft = Omit<Job, 'id' | 'created_at' | 'updated_at'>
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
