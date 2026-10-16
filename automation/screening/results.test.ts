import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { priorityOf, toStoredScreening, validateScreeningResult } from './results.ts'

const valid = () => ({
  id: '0b6f2a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  score: 82,
  recommendation: 'apply',
  reason: 'Entry-level cloud security role in Charlotte; AWS, IAM and Terraform match the Cloud Security resume.',
  strengths: ['AWS IAM and Terraform', 'Charlotte location'],
  gaps: ['No Kubernetes experience listed'],
  resume_version: 'Cloud Security',
  checks: {
    sponsorship: {
      verdict: 'ok',
      note: 'Posting is silent on sponsorship; employer sponsors regularly.',
      uscis: { employer: 'WELLS FARGO BANK N A', fiscalYear: 2025, count: 68, tier: 'strong', source: 'discovery' },
    },
    citizenship: { verdict: 'none', note: 'No citizenship wording.' },
    clearance: { verdict: 'none', note: 'No clearance wording.' },
  },
})

test('a complete result is valid and stored without its id', () => {
  const { result, errors } = validateScreeningResult(valid())
  assert.deepEqual(errors, [])
  const stored = toStoredScreening(result!, 64, 'claude-routine')
  assert.equal('id' in stored, false)
  assert.equal(stored.rule_score, 64)
  assert.equal(stored.checks.sponsorship.uscis.count, 68)
})

test('bad fields are each reported', () => {
  const input = { ...valid(), id: 'nope', score: 101, recommendation: 'yes', resume_version: 'Data', strengths: ['a', 'b', 'c', 'd'] }
  const { result, errors } = validateScreeningResult(input)
  assert.equal(result, null)
  for (const field of ['id', 'score', 'recommendation', 'resume_version', 'strengths']) {
    assert.ok(errors.some((error) => error.startsWith(field)), field)
  }
})

test('a required clearance must be a skip', () => {
  const input = valid()
  input.checks.clearance = { verdict: 'required', note: '"Active Secret clearance required."' }
  assert.match(validateScreeningResult(input).errors.join(' '), /must be "skip"/)
  assert.deepEqual(validateScreeningResult({ ...input, recommendation: 'skip' }).errors, [])
})

test('USCIS check: "none" means no employer, otherwise a real count', () => {
  const none = valid()
  none.checks.sponsorship.uscis = { employer: null, fiscalYear: 2025, count: null, tier: 'none', source: 'none' } as never
  assert.deepEqual(validateScreeningResult(none).errors, [])
  const corrected = valid()
  corrected.checks.sponsorship.uscis = { employer: 'COMMONWEALTH FUSION HR LLC', fiscalYear: 2025, count: 2, tier: 'rare', source: 'corrected' }
  assert.deepEqual(validateScreeningResult(corrected).errors, [])
  const broken = valid()
  broken.checks.sponsorship.uscis = { employer: 'X', fiscalYear: 2025, count: -1, tier: 'rare', source: 'corrected' }
  assert.match(validateScreeningResult(broken).errors.join(' '), /count must be a whole number/)
})

test('priority uses the discovery cut-offs', () => {
  assert.equal(priorityOf(75), 'High')
  assert.equal(priorityOf(55), 'Medium')
  assert.equal(priorityOf(54), 'Low')
})

test('the Edge Function copy is identical', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')
  assert.equal(read('../../supabase/functions/job-screening/validation.ts'), read('results.ts'))
})
