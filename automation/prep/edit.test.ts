import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { applyEdit, type PacketEdit } from './edit.ts'
import type { Packet } from './packet.ts'
import { base, packet as fixturePacket } from './test-fixtures.ts'

const stored = () => fixturePacket() as Packet
// The edit the dashboard sends when nothing changed.
const unchanged = (p: Packet): PacketEdit => ({
  summary: p.summary.text,
  experience: structuredClone(p.experience),
  projects: structuredClone(p.projects),
  cover_letter: [...p.cover_letter.paragraphs],
  answers: { ...p.answers },
})

test('an unchanged edit gives back the same packet and no changes', () => {
  const { packet, errors, changes } = applyEdit(stored(), unchanged(stored()), base())
  assert.deepEqual(errors, [])
  assert.deepEqual(changes, [])
  assert.deepEqual(packet, stored())
})

test('reworded lines are recorded with the base bullet they came from', () => {
  const edit = unchanged(stored())
  edit.experience[0].bullets[1].text = 'Built an access review tool in PowerShell for 3 identity platforms.'
  edit.answers.why_role = 'It matches the Azure work I did at Acme.'
  const { packet, changes } = applyEdit(stored(), edit, base())
  assert.equal(packet!.experience[0].bullets[1].text, 'Built an access review tool in PowerShell for 3 identity platforms.')
  assert.deepEqual(changes.map((change) => [change.kind, change.path]), [['bullet', 'experience[0].bullets[1]'], ['answer', 'answers.why_role']])
  assert.equal(changes[0].before, 'Built an access review tool in PowerShell that covered 3 identity platforms.')
  assert.equal(changes[0].source, 'Built an access review tool in PowerShell covering 3 identity platforms.')
  // Fields an edit can't reach are kept as stored.
  assert.deepEqual(packet!.skills, stored().skills)
  assert.equal(packet!.resume_version, 'Cloud Security')
})

test('bullets can be reordered and removed, not added or duplicated', () => {
  const edit = unchanged(stored())
  edit.experience[0].bullets.reverse()
  const reordered = applyEdit(stored(), edit, base())
  assert.deepEqual(reordered.packet!.experience[0].bullets.map((b) => b.from), ['cloud:acme-intern:1', 'cloudsec:acme-intern:2'])
  assert.deepEqual(reordered.changes, [])

  edit.experience[0].bullets.pop()
  const removed = applyEdit(stored(), edit, base())
  assert.deepEqual(removed.changes.map((change) => change.kind), ['bullet_removed'])

  const added = unchanged(stored())
  added.experience[0].bullets.push({ from: 'cloud:acme-intern:2', text: 'New bullet.' })
  assert.ok(applyEdit(stored(), added, base()).errors.some((error) => error.includes('new ones come from Regenerate')))
  const doubled = unchanged(stored())
  doubled.experience[0].bullets.push({ ...doubled.experience[0].bullets[0] })
  assert.ok(applyEdit(stored(), doubled, base()).errors.some((error) => error.includes('repeats')))
  const empty = unchanged(stored())
  empty.projects[0].bullets = []
  assert.ok(applyEdit(stored(), empty, base()).errors.some((error) => error.includes('at least one bullet')))
})

test('entries and paragraphs keep their count and order', () => {
  const dropped = unchanged(stored())
  dropped.projects = []
  assert.ok(applyEdit(stored(), dropped, base()).errors[0].includes('keep its 1 entries'))
  const swapped = unchanged(stored())
  swapped.experience[0].id = 'honeypot'
  assert.ok(applyEdit(stored(), swapped, base()).errors[0].includes("can't be swapped"))
  const letter = unchanged(stored())
  letter.cover_letter.pop()
  assert.ok(applyEdit(stored(), letter, base()).errors[0].includes('3 paragraphs'))
})

test('the Edge Function copy is identical', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')
  assert.equal(read('../../supabase/functions/_shared/edit.ts'), read('edit.ts'))
})

test('removing a bullet drops it from qualification evidence; a met one left with none is no longer met', () => {
  const withQualifications = (): Packet => ({
    ...stored(),
    qualifications: [
      { text: 'Terraform', kind: 'basic', met: true, evidence: ['cloudsec:acme-intern:2'], note: '' },
      { text: 'Identity tooling', kind: 'basic', met: true, evidence: ['cloudsec:acme-intern:2', 'cloud:acme-intern:1'], note: '' },
    ],
  })
  const edit = unchanged(withQualifications())
  edit.experience[0].bullets.shift()
  const [terraform, identity] = applyEdit(withQualifications(), edit, base()).packet!.qualifications!
  assert.deepEqual(terraform, { text: 'Terraform', kind: 'basic', met: false, evidence: [], note: 'Its evidence was removed in an edit.' })
  assert.deepEqual(identity.evidence, ['cloud:acme-intern:1'])
  assert.equal(identity.met, true)
})
