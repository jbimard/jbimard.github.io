import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formPromptBlock, greenhouseRef, summarizeForm } from './applicationForm.ts'

test('Greenhouse links: board and id from hosted and embedded URLs, null for anything else', () => {
  assert.deepEqual(greenhouseRef('https://job-boards.greenhouse.io/epicgames/jobs/6251540004'), { board: 'epicgames', id: '6251540004' })
  assert.deepEqual(greenhouseRef('https://boards.greenhouse.io/embed/job_app?for=pendo&token=123'), { board: 'pendo', id: '123' })
  assert.deepEqual(greenhouseRef('https://boards.greenhouse.io/pendo/jobs/456?gh_src=x'), { board: 'pendo', id: '456' })
  assert.equal(greenhouseRef('https://example.com/careers?gh_jid=1'), null)
  assert.equal(greenhouseRef('not a url'), null)
  assert.equal(greenhouseRef(null), null)
})

const field = (name: string, type: string, values: string[] = []) => ({ name, type, values: values.map((label) => ({ label })) })

test('summary: standard fields counted and dropped, custom questions kept with choices, eligibility flagged', () => {
  const form = summarizeForm({
    application_deadline: '2026-12-01',
    questions: [
      { label: 'First Name', required: true, fields: [field('first_name', 'input_text')] },
      { label: 'Resume/CV', required: true, fields: [field('resume', 'input_file'), field('resume_text', 'textarea')] },
      { label: 'Will you now or in the future require visa sponsorship?', required: true, fields: [field('question_1', 'multi_value_single_select', ['Yes', 'No'])] },
      { label: 'Are you legally authorized to work in the United States?', required: true, fields: [field('question_2', 'multi_value_single_select', ['Yes', 'No'])] },
      { label: 'Why  do you want\nto work here?', required: false, fields: [field('question_3', 'textarea')] },
      { label: 'LinkedIn Profile', required: false, fields: [field('question_4', 'input_text')] },
    ],
  })
  assert.equal(form.standardCount, 2)
  assert.equal(form.deadline, '2026-12-01')
  assert.deepEqual(form.questions.map((q) => [q.label, q.required, q.kind, q.eligibility]), [
    ['Will you now or in the future require visa sponsorship?', true, 'choice', true],
    ['Are you legally authorized to work in the United States?', true, 'choice', true],
    ['Why do you want to work here?', false, 'long_text', false],
    ['LinkedIn Profile', false, 'text', false],
  ])
  assert.deepEqual(form.questions[0].options, ['Yes', 'No'])
})

test('an empty form gives no prompt block; a real one marks eligibility questions', () => {
  assert.equal(formPromptBlock(summarizeForm({})), '')
  const block = formPromptBlock(summarizeForm({ questions: [{ label: 'Do you require sponsorship?', required: true, fields: [field('q', 'multi_value_single_select', ['Yes', 'No'])] }] }))
  assert.match(block, /Do you require sponsorship\? \(required, choice, ELIGIBILITY: use my fixed work-authorization answers only\)\. Options: Yes \/ No\./)
  assert.match(block, /stop and ask me/)
})
