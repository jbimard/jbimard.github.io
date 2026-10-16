// Closed-posting check: what each check result does to a job row. Two strikes on different days close it.
// supabase/functions/job-link-check/strikes.ts must stay an exact copy of this file (strikes.test.ts checks).
// No imports, so the same file runs under Node and Deno.

export const LINK_RESULTS = ['open', 'missing', 'unverified'] as const
export const LINK_VIAS = ['greenhouse', 'lever', 'ashby', 'workday', 'simplify', 'http'] as const
// Closed postings here are archived as Closed.
export const CHECKED_STATUSES = ['Queued', 'Found', 'Fit Check', 'Ready to Apply'] as const
// Already applied: postings often close once the applicant pool is full, so only a note is added.
export const NOTE_ONLY_STATUSES = ['Applied', 'Follow-Up'] as const
export const STRIKES_TO_CLOSE = 2

export type LinkResult = (typeof LINK_RESULTS)[number]
export type LinkVia = (typeof LINK_VIAS)[number]
export type LinkCheck = { id: string; result: LinkResult; via: LinkVia }

export type LinkRow = {
  status: string
  notes: string | null
  link_status: LinkResult | null
  link_missing_count: number
  link_checked_at: string | null
}

export type LinkPatch = {
  link_status: LinkResult
  link_missing_count: number
  link_checked_at: string
  status?: 'Closed'
  archived?: true
  notes?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const validateLinkCheck = (input: unknown): { check: LinkCheck | null; errors: string[] } => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { check: null, errors: ['check must be an object.'] }
  const value = input as Record<string, unknown>
  const errors: string[] = []
  if (typeof value.id !== 'string' || !UUID.test(value.id)) errors.push('id must be a job UUID.')
  if (!LINK_RESULTS.includes(value.result as LinkResult)) errors.push(`result must be one of: ${LINK_RESULTS.join(', ')}.`)
  if (!LINK_VIAS.includes(value.via as LinkVia)) errors.push(`via must be one of: ${LINK_VIAS.join(', ')}.`)
  return { check: errors.length === 0 ? { id: value.id, result: value.result, via: value.via } as LinkCheck : null, errors }
}

const day = (iso: string) => iso.slice(0, 10)

export const closedNote = (checkedAt: string, via: LinkVia) => `Posting closed (checked ${day(checkedAt)} via ${via})`

const appendNote = (notes: string | null, line: string) => (notes?.trim() ? `${notes.trim()}\n${line}` : line)

// outcome: 'closed' (archived as Closed), 'noted' (applied job, note only) or null.
export const nextLinkState = (row: LinkRow, check: LinkCheck, now: Date): { patch: LinkPatch; outcome: 'closed' | 'noted' | null } => {
  const checkedAt = now.toISOString()
  if (check.result === 'open') return { patch: { link_status: 'open', link_missing_count: 0, link_checked_at: checkedAt }, outcome: null }
  // Not evidence either way: the count stays, but the check date moves, so a later "missing" the same day adds nothing.
  if (check.result === 'unverified') {
    return { patch: { link_status: 'unverified', link_missing_count: row.link_missing_count, link_checked_at: checkedAt }, outcome: null }
  }

  // A second "missing" only counts on a later (UTC) day than the last check, so re-running the workflow can't close a job.
  const newStrike = row.link_missing_count === 0 || !row.link_checked_at || day(row.link_checked_at) < day(checkedAt)
  const count = newStrike ? row.link_missing_count + 1 : row.link_missing_count
  const patch: LinkPatch = { link_status: 'missing', link_missing_count: count, link_checked_at: checkedAt }
  const reachedClose = count >= STRIKES_TO_CLOSE && row.link_missing_count < STRIKES_TO_CLOSE

  if (count >= STRIKES_TO_CLOSE && (CHECKED_STATUSES as readonly string[]).includes(row.status)) {
    return { patch: { ...patch, status: 'Closed', archived: true, notes: appendNote(row.notes, closedNote(checkedAt, check.via)) }, outcome: 'closed' }
  }
  if (reachedClose && (NOTE_ONLY_STATUSES as readonly string[]).includes(row.status)) {
    return { patch: { ...patch, notes: appendNote(row.notes, closedNote(checkedAt, check.via)) }, outcome: 'noted' }
  }
  return { patch, outcome: null }
}
