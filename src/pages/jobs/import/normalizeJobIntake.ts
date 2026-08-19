import type { NormalizedJobIntake } from './jobIntakeSchema'

type RawJobObject = Record<string, unknown>

export const parseJobIntakeJson = (text: string): { ok: true; rows: unknown[] } | { ok: false; error: string } => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Input must be valid JSON. Check for trailing commas, comments, or missing quotes.' }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Input must be a JSON array of job objects, e.g. `[ { ... } ]`.' }
  }

  if (parsed.length === 0) {
    return { ok: false, error: 'Input must include at least one job object.' }
  }

  return { ok: true, rows: parsed }
}

const isObject = (value: unknown): value is RawJobObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const optionalString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
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

export const normalizeJobIntakeRow = (raw: unknown): NormalizedJobIntake => {
  const row = isObject(raw) ? raw : {}

  return {
    company: requiredString(row.company),
    role_title: requiredString(row.role_title),
    location: optionalString(row.location),
    job_link: optionalString(row.job_link),
    status: enumish(row.status, 'Found'),
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
