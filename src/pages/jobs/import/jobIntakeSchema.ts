import {
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  type JobDraft,
} from '../types'

export { JOB_TYPE_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS, WORK_MODE_OPTIONS }

export const JOB_INTAKE_FIELDS = [
  'company',
  'role_title',
  'job_link',
  'job_type',
  'location',
  'work_mode',
  'start_date',
  'graduation_requirement',
  'sponsorship_notes',
  'e_verify_notes',
  'required_skills',
  'match_score',
  'status',
  'priority',
  'resume_version',
  'cover_letter_status',
  'recruiter_contact',
  'date_found',
  'date_applied',
  'follow_up_date',
  'job_description',
  'notes',
] as const

export const JOB_INTAKE_SCHEMA_TEXT = `Return only a valid JSON array. Do not wrap in markdown. Each array item must be a job object using only these fields: ${JOB_INTAKE_FIELDS.join(', ')}.

Required fields:
- company
- role_title

Defaults when omitted or blank:
- status: Found
- priority: Medium
- work_mode: Unknown
- date_found: today's date

Use null for unknown optional fields. Dates must be YYYY-MM-DD. match_score must be null or a number from 0 to 100. job_link must be an http or https URL when provided.

Example:
[
  {
    "company": "Momentum",
    "role_title": "Software Engineer, New Grad",
    "job_link": "https://example.com/jobs/momentum-software-engineer-new-grad",
    "job_type": "New Grad",
    "location": "Charlotte, NC",
    "work_mode": "Hybrid",
    "start_date": "2027-06-01",
    "graduation_requirement": "Bachelor's degree in Computer Science or related field by Spring 2027.",
    "sponsorship_notes": "No sponsorship mentioned.",
    "e_verify_notes": "E-Verify not mentioned.",
    "required_skills": "TypeScript, React, Node.js, SQL, cloud fundamentals.",
    "match_score": 86,
    "status": "Found",
    "priority": "High",
    "resume_version": "software-engineering-general",
    "cover_letter_status": "Not started",
    "recruiter_contact": null,
    "date_found": "2026-08-19",
    "date_applied": null,
    "follow_up_date": null,
    "job_description": "Build customer-facing web applications with React and backend services.",
    "notes": "Strong match for React, TypeScript, and SQL experience."
  }
]`

export type NormalizedJobIntake = Omit<
  JobDraft,
  'user_id' | 'status' | 'priority' | 'job_type' | 'work_mode' | 'match_score'
> & {
  status: string
  priority: string
  job_type: string | null
  work_mode: string
  match_score: unknown
}
