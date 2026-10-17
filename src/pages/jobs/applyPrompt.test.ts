import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appliedPatch, buildApplyPrompt } from './applyPrompt.ts'
import type { ApplicationPacket, Job } from './types.ts'

const job = { company: 'Example Co', role_title: 'Cloud Security Engineer', job_link: 'https://example.com/jobs/1' } as Job
const packet = {
  resume_version: 'Cloud Security',
  cover_letter: 'Dear team,\n\nI build things.\n',
  answers: [
    { key: 'why_company', question: 'Why this company?', answer: 'Because of the work.' },
    { key: 'anything_else', question: 'Anything else?', answer: '  ' },
  ],
  work_authorization: [{ question: 'Will you now or in the future require sponsorship?', answer: 'Yes' }],
} as ApplicationPacket

test('Mark applied sets today and a follow-up a week out', () => {
  assert.deepEqual(appliedPatch('2026-10-28'), { status: 'Applied', date_applied: '2026-10-28', follow_up_date: '2026-11-04' })
  assert.equal(appliedPatch('2026-12-29').follow_up_date, '2027-01-05')
})

test('the prompt carries the stop-before-submit rule and the fixed work-authorization answers', () => {
  const prompt = buildApplyPrompt(job, packet)
  assert.match(prompt, /Never click Submit/)
  assert.match(prompt, /Never create an account, type a password/)
  assert.match(prompt, /Q: Will you now or in the future require sponsorship\?\nA: Yes/)
  assert.match(prompt, /https:\/\/example\.com\/jobs\/1/)
  assert.match(prompt, /Cloud Security resume/)
})

test('blank answers are left out and a missing link asks for one', () => {
  const prompt = buildApplyPrompt({ ...job, job_link: null }, packet)
  assert.doesNotMatch(prompt, /Anything else\?/)
  assert.match(prompt, /no link saved; ask me for it/)
})
