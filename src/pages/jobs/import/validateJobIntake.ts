import type { Job, JobDraft, JobPriority, JobStatus, JobType, WorkMode } from '../types'
import {
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  type NormalizedJobIntake,
} from './jobIntakeSchema'
import { normalizeJobIntakeRow } from './normalizeJobIntake'

export type JobIntakeRowResult = {
  index: number
  input: unknown
  normalized: NormalizedJobIntake
  errors: string[]
  duplicateBlocked: boolean
  duplicateWarning: boolean
}

const isIn = <Value extends string>(value: string, options: readonly Value[]): value is Value => (
  options.includes(value as Value)
)

const validateDate = (field: string, value: string | null) => {
  if (value === null || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${field} must use YYYY-MM-DD format.`

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return `${field} must be a real calendar date.`
  }

  return null
}

const normalizeUrl = (value: string | null) => value?.trim() ?? ''

const companyRoleKey = (company: string | null, roleTitle: string | null) => (
  `${company?.trim().toLowerCase() ?? ''}\u0000${roleTitle?.trim().toLowerCase() ?? ''}`
)

export const validateJobIntakeRow = (row: NormalizedJobIntake): string[] => {
  const errors: string[] = []

  if (row.company.trim() === '') errors.push('company is required.')
  if (row.role_title.trim() === '') errors.push('role_title is required.')

  if (!isIn(row.status, STATUS_OPTIONS)) {
    errors.push(`status must be one of: ${STATUS_OPTIONS.join(', ')}.`)
  }

  if (!isIn(row.priority, PRIORITY_OPTIONS)) {
    errors.push(`priority must be one of: ${PRIORITY_OPTIONS.join(', ')}.`)
  }

  if (!isIn(row.work_mode, WORK_MODE_OPTIONS)) {
    errors.push(`work_mode must be one of: ${WORK_MODE_OPTIONS.join(', ')}.`)
  }

  if (row.job_type !== null && !isIn(row.job_type, JOB_TYPE_OPTIONS)) {
    errors.push(`job_type must be null or one of: ${JOB_TYPE_OPTIONS.join(', ')}.`)
  }

  if (
    row.match_score !== null
    && (typeof row.match_score !== 'number' || !Number.isFinite(row.match_score) || row.match_score < 0 || row.match_score > 100)
  ) {
    errors.push('match_score must be null or a finite number from 0 to 100.')
  }

  for (const field of ['start_date', 'date_found', 'date_applied', 'follow_up_date'] as const) {
    const error = validateDate(field, row[field])
    if (error) errors.push(error)
  }

  if (row.job_link !== null) {
    try {
      const url = new URL(row.job_link)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push('job_link must be an http or https URL.')
      }
    } catch {
      errors.push('job_link must be a valid URL.')
    }
  }

  return errors
}

export const toJobDraft = (row: NormalizedJobIntake): Omit<JobDraft, 'user_id'> => ({
  company: row.company,
  role_title: row.role_title,
  location: row.location,
  job_link: row.job_link,
  status: row.status as JobStatus,
  priority: row.priority as JobPriority,
  job_type: row.job_type as JobType | null,
  work_mode: row.work_mode as WorkMode,
  match_score: row.match_score as number | null,
  required_skills: row.required_skills,
  sponsorship_notes: row.sponsorship_notes,
  start_date: row.start_date,
  graduation_requirement: row.graduation_requirement,
  e_verify_notes: row.e_verify_notes,
  cover_letter_status: row.cover_letter_status,
  recruiter_contact: row.recruiter_contact,
  job_description: row.job_description,
  notes: row.notes,
  resume_version: row.resume_version,
  date_found: row.date_found,
  date_applied: row.date_applied,
  follow_up_date: row.follow_up_date,
  archived: row.archived,
})

export const willImport = (row: JobIntakeRowResult, allowDuplicates: boolean) => (
  row.errors.length === 0 && (allowDuplicates || !row.duplicateBlocked)
)

export const buildJobIntakeReport = (
  rawRows: unknown[],
  existingJobs: Job[],
  allowDuplicates: boolean,
): JobIntakeRowResult[] => {
  const existingLinks = new Set(
    existingJobs.map((job) => normalizeUrl(job.job_link)).filter((link) => link !== ''),
  )
  const existingCompanyRoles = new Set(
    existingJobs.map((job) => companyRoleKey(job.company, job.role_title)),
  )
  const batchLinks = new Set<string>()

  return rawRows.map((input, index) => {
    const normalized = normalizeJobIntakeRow(input)
    const errors = validateJobIntakeRow(normalized)
    const link = normalizeUrl(normalized.job_link)
    const duplicateBlocked = !allowDuplicates && errors.length === 0 && link !== '' && (
      existingLinks.has(link) || batchLinks.has(link)
    )
    const duplicateWarning = existingCompanyRoles.has(companyRoleKey(normalized.company, normalized.role_title))

    if (errors.length === 0 && link !== '') {
      batchLinks.add(link)
    }

    return {
      index,
      input,
      normalized,
      errors,
      duplicateBlocked,
      duplicateWarning,
    }
  })
}
