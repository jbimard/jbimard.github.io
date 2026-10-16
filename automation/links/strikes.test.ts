import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { nextLinkState, validateLinkCheck, type LinkCheck, type LinkRow } from './strikes.ts'

const ID = '0b6f2a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const row = (patch: Partial<LinkRow> = {}): LinkRow => ({
  status: 'Queued', notes: null, link_status: null, link_missing_count: 0, link_checked_at: null, ...patch,
})
const missing: LinkCheck = { id: ID, result: 'missing', via: 'greenhouse' }
const day1 = new Date('2026-10-20T10:05:00Z')
const day1Later = new Date('2026-10-20T15:00:00Z')
const day2 = new Date('2026-10-21T10:05:00Z')

test('one "missing" is a strike, not a close', () => {
  const { patch, outcome } = nextLinkState(row(), missing, day1)
  assert.deepEqual(patch, { link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  assert.equal(outcome, null)
})

test('a second "missing" on a later day closes and archives with a note', () => {
  const struck = row({ notes: 'Rule score 71.', link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  const { patch, outcome } = nextLinkState(struck, missing, day2)
  assert.equal(outcome, 'closed')
  assert.equal(patch.status, 'Closed')
  assert.equal(patch.archived, true)
  assert.equal(patch.link_missing_count, 2)
  assert.equal(patch.notes, 'Rule score 71.\nPosting closed (checked 2026-10-21 via greenhouse)')
})

test('a re-run the same day adds no strike', () => {
  const struck = row({ link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  const { patch, outcome } = nextLinkState(struck, missing, day1Later)
  assert.equal(patch.link_missing_count, 1)
  assert.equal(outcome, null)
  assert.equal(patch.status, undefined)
})

test('"open" resets the count; "unverified" keeps it', () => {
  const struck = row({ link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  assert.equal(nextLinkState(struck, { ...missing, result: 'open' }, day2).patch.link_missing_count, 0)
  const unverified = nextLinkState(struck, { ...missing, result: 'unverified' }, day2)
  assert.deepEqual(unverified.patch, { link_status: 'unverified', link_missing_count: 1, link_checked_at: day2.toISOString() })
  assert.equal(unverified.outcome, null)
})

test('every pre-apply status closes', () => {
  for (const status of ['Queued', 'Found', 'Fit Check', 'Ready to Apply']) {
    const struck = row({ status, link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
    assert.equal(nextLinkState(struck, missing, day2).outcome, 'closed', status)
  }
})

test('an applied job only gets a note, once', () => {
  const struck = row({ status: 'Applied', notes: '', link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  const { patch, outcome } = nextLinkState(struck, { ...missing, via: 'workday' }, day2)
  assert.equal(outcome, 'noted')
  assert.equal(patch.status, undefined)
  assert.equal(patch.archived, undefined)
  assert.equal(patch.notes, 'Posting closed (checked 2026-10-21 via workday)')
  const again = nextLinkState({ ...struck, notes: patch.notes!, link_missing_count: 2, link_checked_at: day2.toISOString() }, missing, new Date('2026-10-22T10:00:00Z'))
  assert.equal(again.outcome, null)
  assert.equal(again.patch.notes, undefined)
})

test('later stages are never touched', () => {
  const struck = row({ status: 'Interview', link_status: 'missing', link_missing_count: 1, link_checked_at: day1.toISOString() })
  const { patch, outcome } = nextLinkState(struck, missing, day2)
  assert.equal(outcome, null)
  assert.equal(patch.status, undefined)
})

test('the validator rejects bad fields', () => {
  assert.deepEqual(validateLinkCheck(missing).errors, [])
  const { check, errors } = validateLinkCheck({ id: 'nope', result: 'gone', via: 'linkedin' })
  assert.equal(check, null)
  assert.equal(errors.length, 3)
  assert.deepEqual(validateLinkCheck([]).errors, ['check must be an object.'])
})

test('the Edge Function copy is identical', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')
  assert.equal(read('../../supabase/functions/job-link-check/strikes.ts'), read('strikes.ts'))
})
