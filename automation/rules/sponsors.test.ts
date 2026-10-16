import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Profile } from '../types.ts'
import { evaluatePosting } from './score.ts'
import {
  buildSponsorData,
  decodeExport,
  fromSponsorFile,
  indexSponsors,
  lookupSponsor,
  normalizeEmployer,
  parseDelimited,
  readHubRows,
  serializeSponsorFile,
  tierOf,
  toSponsorFile,
  type HubRow,
} from './sponsors.ts'

const profile = JSON.parse(readFileSync(path.join(import.meta.dirname, '../config/profile.json'), 'utf8')) as Profile

const row = (employer: string, fiscalYear: number, newEmploymentApproval: number): HubRow => ({ employer, fiscalYear, newEmploymentApproval })

const data = buildSponsorData([
  row('WELLS FARGO BANK NA', 2024, 150),
  row('WELLS FARGO BANK NA', 2025, 180),
  row('Wells Fargo Securities, LLC', 2025, 32),
  row('WELLS FARGO BANK NA', 2026, 95),
  row('BOX INC', 2025, 12),
  row('BOX HILL HOSPITAL', 2025, 40),
  row('FMR LLC', 2025, 3),
  row('LOWE\'S COMPANIES INC', 2024, 7),
  row('NO APPROVALS CORP', 2025, 0),
], { source: 'test', partialYear: 2026, builtAt: '2026-10-15' })
const index = indexSponsors(data)
const lookup = (company: string, aliases?: string[]) => lookupSponsor(index, company, profile.sponsorTiers, aliases)

test('employer names normalize past punctuation and legal suffixes', () => {
  assert.equal(normalizeEmployer('Wells Fargo Bank, N.A.'), 'wells fargo bank')
  assert.equal(normalizeEmployer('WELLS FARGO BANK NA'), 'wells fargo bank')
  assert.equal(normalizeEmployer("Lowe's Companies, Inc."), 'lowes companies')
  assert.equal(normalizeEmployer('AT&T Services Inc'), 'at and t services')
  assert.equal(normalizeEmployer('The Vanguard Group, Inc.'), 'vanguard group')
  assert.equal(normalizeEmployer('FMR LLC D/B/A Fidelity Investments'), 'fidelity investments')
  assert.equal(normalizeEmployer('Functional Software Inc DBA Sentry'), 'sentry')
})

test('build sums approvals per normalized name and drops zero rows', () => {
  assert.deepEqual(data.fiscalYears, [2024, 2025, 2026])
  assert.deepEqual(data.employers['wells fargo bank'].byYear, { 2024: 150, 2025: 180, 2026: 95 })
  assert.equal(data.employers['no approvals'], undefined)
})

test('the committed file format round-trips', () => {
  const text = serializeSponsorFile(toSponsorFile(data))
  assert.deepEqual(fromSponsorFile(JSON.parse(text)), data)
  assert.match(text, /\n {4}\["WELLS FARGO BANK NA",150,180,95\],\n/)
})

test('loose matching sums related names but not unrelated ones', () => {
  const wells = lookup('Wells Fargo')
  assert.equal(wells.count, 212)
  assert.equal(wells.fiscalYear, 2025)
  assert.equal(wells.tier, 'strong')
  assert.equal(wells.matchedNames.length, 2)
  // "Box" must not pick up "Box Hill Hospital".
  assert.equal(lookup('Box').count, 12)
  assert.equal(lookup("Lowe's").count, 0)
  assert.equal(lookup("Lowe's").byYear[2024], 7)
  assert.equal(lookup('Acme').matchedNames.length, 0)
})

test('aliases replace the company name', () => {
  assert.equal(lookup('Fidelity Investments').matchedNames.length, 0)
  const fidelity = lookup('Fidelity Investments', ['FMR'])
  assert.equal(fidelity.count, 3)
  assert.equal(fidelity.tier, 'rare')
})

test('tiers follow the profile thresholds', () => {
  assert.equal(tierOf(50, profile.sponsorTiers), 'strong')
  assert.equal(tierOf(49, profile.sponsorTiers), 'some')
  assert.equal(tierOf(5, profile.sponsorTiers), 'some')
  assert.equal(tierOf(4, profile.sponsorTiers), 'rare')
  assert.equal(tierOf(0, profile.sponsorTiers), 'none')
})

test('the tier uses the latest complete fiscal year, not the partial one', () => {
  const partialOnly = buildSponsorData([row('NEWCO INC', 2024, 1), row('NEWCO INC', 2026, 90)], { source: 'test', partialYear: 2026, builtAt: '' })
  const record = lookupSponsor(indexSponsors(partialOnly), 'Newco', profile.sponsorTiers)
  assert.equal(record.fiscalYear, 2024)
  assert.equal(record.tier, 'rare')
})

test('labels show the USCIS count, other years, and misses', () => {
  assert.equal(lookup('Wells Fargo').label, 'USCIS: 212 new-employment H-1B approvals in FY2025 (FY2026 to date: 95; FY2024: 150).')
  assert.equal(lookup('Acme').label, 'USCIS: no new-employment H-1B approvals on record for "Acme" (FY2024–FY2025; name match may miss).')
})

test('the label and tier reach the scored job', () => {
  const posting = {
    source: 'test', company: 'Wells Fargo', title: 'Cloud Security Engineer, New Grad 2027', url: 'https://example.com/1',
    location: 'Charlotte, NC', description: 'AWS and Terraform.', workplaceHint: null, salaryText: null, simplifySponsorship: null,
  }
  const strong = evaluatePosting(posting, profile, lookup('Wells Fargo'))
  const box = evaluatePosting({ ...posting, company: 'Box' }, profile, lookup('Box'))
  assert.ok(strong.kind === 'kept' && box.kind === 'kept')
  assert.match(strong.job.sponsorship_notes ?? '', /USCIS: 212 new-employment H-1B approvals in FY2025/)
  assert.equal(strong.breakdown.sponsor, profile.sponsorPoints.strong)
  assert.equal(box.breakdown.sponsor, profile.sponsorPoints.some)
})

test('hub exports parse with quotes, tabs, UTF-16 and header variants', () => {
  const csv = 'Fiscal Year,Employer (Petitioner) Name,New Employment Approval,New Employment Denial\r\n2025,"ACME, INC.","1,234",2\r\n2025,"Say ""Hi"" LLC",3,0\r\n'
  assert.deepEqual(readHubRows(parseDelimited(csv)), [row('ACME, INC.', 2025, 1234), row('Say "Hi" LLC', 2025, 3)])

  const tsv = 'Fiscal Year\tEmployer\tNew Employment Approval\n2024\tBox Inc\t12\n'
  const utf16 = new Uint8Array([0xff, 0xfe, ...new Uint8Array(new Uint16Array([...tsv].map((char) => char.charCodeAt(0))).buffer)])
  assert.deepEqual(readHubRows(parseDelimited(decodeExport(utf16))), [row('Box Inc', 2024, 12)])

  assert.throws(() => readHubRows(parseDelimited('Fiscal Year,Employer,Initial Approval\n2023,X,1\n')), /Missing column\(s\) newEmploymentApproval/)
})
