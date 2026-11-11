import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkExtraction, overall, squeeze, type Expected } from './parseCheck.ts'

const expected: Expected = {
  summary: 'Security student building cloud detections on AWS.',
  entries: [
    { heading: 'Security Intern', right: 'Jun 2025 - Aug 2025', bullets: ['Built an audit tool covering four Microsoft platforms.', 'Cut a 62-minute check to 4 minutes.'] },
    { heading: 'Detection Lab', right: null, bullets: ['Wrote Sigma rules for AWS CloudTrail events.'] },
  ],
}

const good = `Joseph Example
Raleigh, NC | joseph@example.com | (919) 555-0142
Summary
Security student building cloud detections on AWS.
Education
UNC Charlotte, B.S. Computer Science
Experience
Security Intern, Example Co  Jun 2025 – Aug 2025
• Built an audit tool covering four
Microsoft platforms.
• Cut a 62-minute check to 4 minutes.
Projects
Detection Lab
• Wrote Sigma rules for AWS CloudTrail events.
Skills
AWS, Python, Terraform, Linux, SIEM, Splunk, Kubernetes`

const byId = (text: string) => Object.fromEntries(checkExtraction(text, expected).map((finding) => [finding.id, finding.status]))

test('squeeze: ligatures, quotes, dashes and line wraps compare equal', () => {
  assert.equal(squeeze('ﬁrst “end–to–end”\n check'), squeeze('first "end-to-end" check'))
})

test('a clean extraction passes every check, even with a bullet wrapped over two lines', () => {
  const results = checkExtraction(good, expected)
  assert.deepEqual(results.filter((finding) => finding.status !== 'pass'), [])
  assert.equal(overall(results), 'pass')
})

test('almost no text fails alone: an image-only file', () => {
  assert.deepEqual(checkExtraction('Joseph', expected).map((finding) => [finding.id, finding.status]), [['text', 'fail']])
})

test('contact details only in a header are missing from the body', () => {
  const noContact = good.replace(/^.*\n.*\n/, 'Joseph Example\n')
  assert.equal(byId(noContact).contact, 'fail')
})

test('a bullet that never comes out, and a date that comes out wrong, are named', () => {
  const broken = good.replace('• Cut a 62-minute check to 4 minutes.\n', '').replace('Jun 2025 – Aug 2025', 'Jun 2025')
  const results = checkExtraction(broken, expected)
  const content = results.find((finding) => finding.id === 'content')
  assert.equal(content?.status, 'fail')
  assert.match(content?.detail ?? '', /Cut a 62-minute check/)
  assert.equal(byId(broken).dates, 'fail')
})

test('two-column scrambling: bullets read out of order, headings out of order', () => {
  const scrambled = good.replace('Projects\nDetection Lab\n• Wrote Sigma rules for AWS CloudTrail events.\n', '')
    .replace('Education\n', 'Projects\nDetection Lab\n• Wrote Sigma rules for AWS CloudTrail events.\nEducation\n')
  const result = byId(scrambled)
  assert.equal(result.order, 'warn')
  assert.equal(result.reading_order, 'fail')
})

test('broken glyphs and letter-spaced text fail the encoding check', () => {
  assert.equal(byId(`${good}\nS e c u r i t y E n g\n`).encoding, 'fail')
  assert.equal(byId(`${good}\n��`).encoding, 'fail')
})

test('nonstandard headings are reported', () => {
  const renamed = good.replace('Experience\n', 'Where I have worked\n')
  const result = checkExtraction(renamed, expected).find((finding) => finding.id === 'headings')
  assert.equal(result?.status, 'warn')
  assert.match(result?.detail ?? '', /Experience/)
})
