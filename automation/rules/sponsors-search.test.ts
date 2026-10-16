import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { buildSponsorData, fromSponsorFile, indexSponsors, searchSponsors, type HubRow } from './sponsors.ts'

const row = (employer: string, fiscalYear: number, newEmploymentApproval: number): HubRow => ({ employer, fiscalYear, newEmploymentApproval })

test('search finds entities the strict match misses, best overlap first', () => {
  const index = indexSponsors(buildSponsorData([
    row('COMMONWEALTH FUSION HR LLC', 2025, 2),
    row('COMMONWEALTH BANK OF AUSTRALIA', 2025, 9),
    row('HARVEY AI CORPORATION', 2026, 5),
    row('HARVEY MUDD COLLEGE', 2025, 3),
  ], { source: 'test', partialYear: 2026, builtAt: '' }))
  assert.equal(searchSponsors(index, 'Commonwealth Fusion Systems')[0].name, 'COMMONWEALTH FUSION HR LLC')
  assert.deepEqual(searchSponsors(index, 'Harvey').map((c) => c.name).sort(), ['HARVEY AI CORPORATION', 'HARVEY MUDD COLLEGE'])
  assert.deepEqual(searchSponsors(index, 'Nobody Here'), [])
})

test('search finds the real entities in the committed USCIS file', () => {
  const index = indexSponsors(fromSponsorFile(JSON.parse(readFileSync(path.join(import.meta.dirname, '../data/h1b-sponsors.json'), 'utf8'))))
  assert.equal(searchSponsors(index, 'Commonwealth Fusion Systems')[0].name, 'COMMONWEALTH FUSION HR LLC')
  assert.ok(searchSponsors(index, 'Harvey').some((candidate) => candidate.name === 'HARVEY AI CORPORATION'))
})
