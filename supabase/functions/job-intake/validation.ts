// Mirrors src/pages/jobs/import/{jobIntakeSchema,normalizeJobIntake,validateJobIntake}.ts.
// Keep this Deno copy in sync manually when frontend intake rules change.

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

export type NormalizedJobIntake = {
  company: string
  role_title: string
  location: string | null
  job_link: string | null
  status: string
  priority: string
  job_type: string | null
  work_mode: string
  match_score: unknown
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
  date_found: string
  date_applied: string | null
  follow_up_date: string | null
  archived: boolean
}

type RawJobObject = Record<string, unknown>

const isObject = (value: unknown): value is RawJobObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const optionalString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const normalizeJobLink = (value: unknown) => {
  const trimmed = optionalString(value)
  if (trimmed === null) return null
  const markdownLink = trimmed.match(/^\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/)
  return markdownLink ? markdownLink[2] : trimmed
}

const requiredString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const enumish = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed === '' ? fallback : trimmed
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

export const normalizeJobIntakeRow = (raw: unknown): NormalizedJobIntake => {
  const row = isObject(raw) ? raw : {}

  return {
    company: requiredString(row.company),
    role_title: requiredString(row.role_title),
    location: optionalString(row.location),
    job_link: normalizeJobLink(row.job_link),
    status: enumish(row.status, 'Fit Check'),
    priority: enumish(row.priority, 'Medium'),
    job_type: optionalString(row.job_type),
    work_mode: enumish(row.work_mode, 'Unknown'),
    match_score: row.match_score ?? null,
    required_skills: optionalString(row.required_skills),
    sponsorship_notes: optionalString(row.sponsorship_notes),
    start_date: optionalString(row.start_date),
    graduation_requirement: optionalString(row.graduation_requirement),
    e_verify_notes: optionalString(row.e_verify_notes),
    cover_letter_status: optionalString(row.cover_letter_status),
    recruiter_contact: optionalString(row.recruiter_contact),
    job_description: optionalString(row.job_description),
    notes: optionalString(row.notes),
    resume_version: optionalString(row.resume_version),
    date_found: optionalString(row.date_found) ?? new Date().toISOString().slice(0, 10),
    date_applied: optionalString(row.date_applied),
    follow_up_date: optionalString(row.follow_up_date),
    archived: row.archived === true,
  }
}

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

export const toJobInsertRow = (row: NormalizedJobIntake, userId: string) => ({
  user_id: userId,
  company: row.company,
  role_title: row.role_title,
  location: row.location,
  job_link: row.job_link,
  status: row.status,
  priority: row.priority,
  job_type: row.job_type,
  work_mode: row.work_mode,
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
