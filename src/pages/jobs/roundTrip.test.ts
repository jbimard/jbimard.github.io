import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Expected } from './parseCheck.ts'
import { roundTrip } from './roundTrip.ts'

const expected: Expected = {
  summary: 'Cloud security student building detections on AWS.',
  entries: [
    { heading: 'Security Intern', right: 'Jun 2025 - Aug 2025', bullets: ['Built an audit tool covering four Microsoft platforms.', 'Cut a 62-minute check to 4 minutes.'] },
    { heading: 'Detection Lab', right: null, bullets: ['Wrote Sigma rules for AWS CloudTrail events.'] },
  ],
}
const clean = `Cloud security student building detections on AWS.
Security Intern Jun 2025 – Aug 2025
• Built an audit tool covering four Microsoft platforms.
• Cut a 62-minute check to 4 minutes.
Detection Lab
• Wrote Sigma rules for AWS CloudTrail events.`

test('a clean extraction scores full recall and full order fidelity', () => {
  const trip = roundTrip(clean, expected)
  assert.equal(trip.recall, 1)
  assert.equal(trip.orderFidelity, 1)
  assert.ok(trip.fields.every((field) => field.status === 'found'))
})

test('half-extracted lines are garbled, absent ones missing, and recall drops', () => {
  const trip = roundTrip(clean.replace('covering four Microsoft platforms', 'covering').replace('• Cut a 62-minute check to 4 minutes.\n', ''), expected)
  const status = Object.fromEntries(trip.fields.map((field) => [field.text.slice(0, 12), field.status]))
  assert.equal(status['Built an aud'], 'garbled')
  assert.equal(status['Cut a 62-min'], 'missing')
  assert.ok(trip.recall < 0.9 && trip.recall > 0.5)
})

test('lines read in reverse order drive the order fidelity to about zero', () => {
  const reversed = clean.split('\n').reverse().join('\n')
  // The heading and its dates share a line, so that one pair stays in order.
  assert.ok(roundTrip(reversed, expected).orderFidelity < 0.1)
})

test('a repeated word is only counted once per use (no field borrows another field\'s words)', () => {
  const twice: Expected = { summary: null, entries: [{ heading: 'AWS', right: null, bullets: ['AWS'] }] }
  assert.equal(roundTrip('AWS', twice).recall, 0.5)
})

test('an empty expectation is full recall', () => {
  assert.deepEqual(roundTrip('anything', { summary: null, entries: [] }), { recall: 1, orderFidelity: 1, fields: [] })
})
