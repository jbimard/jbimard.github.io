import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Profile, RawPosting } from '../types.ts'
import { parseProfile, profileProblems } from './profile.ts'
import { evaluatePosting } from './score.ts'
import { NO_SPONSOR_DATA, type SponsorRecord } from './sponsors.ts'
import { scoreLocation } from './text.ts'

const owner = JSON.parse(readFileSync(path.join(import.meta.dirname, '../config/profile.json'), 'utf8')) as Profile

// A generic U.S.-citizen lab-science profile: nothing here is any real person's settings.
const labProfile: Profile = {
  ...owner,
  needsSponsorship: false,
  useSimplify: false,
  companyTags: ['biotech'],
  graduation: '2026-12',
  targetYears: [2026, 2027],
  titleGroups: { A: ['research associate'], B: ['process development'], C: ['laboratory technician'] },
  excludeTitle: ['senior', 'ii', 'intern'],
  rotationalTitle: [],
  rotationalTechWords: [],
  offTargetTitle: [],
  rolePoints: { A: 25, B: 18, C: 10, offTarget: 4 },
  levelPoints: 35,
  payWeight: 0,
  skillPoints: { perMatch: 2, max: 10 },
  employerWatchlist: ['Acme Bio'],
  employerPoints: 10,
  metroOnly: true,
  metros: { core: { label: 'Durham', points: 20, match: ['durham'] } },
  remoteUsPoints: 4,
  otherUsPoints: 0,
  skills: ['PCR', 'HPLC'],
  minScore: 45,
}

const posting = (overrides: Partial<RawPosting> = {}): RawPosting => ({
  source: 'test',
  company: 'Other Bio',
  title: 'Research Associate I',
  url: 'https://example.com/jobs/1',
  location: 'Durham, NC',
  description: 'This is an entry-level role. You will run PCR and HPLC assays.',
  workplaceHint: null,
  salaryText: null,
  simplifySponsorship: null,
  ...overrides,
})

const kept = (overrides: Partial<RawPosting> = {}, profile: Profile = labProfile, sponsor: SponsorRecord = NO_SPONSOR_DATA) => {
  const result = evaluatePosting(posting(overrides), profile, sponsor)
  assert.equal(result.kind, 'kept')
  return result.kind === 'kept' ? result : (undefined as never)
}

test('a profile that needs no sponsorship scores no sponsor or pay points', () => {
  const { breakdown } = kept({ salaryText: '$150,000 - $170,000 a year' })
  assert.equal(breakdown.sponsor, 0)
  assert.equal(breakdown.pay, 0)
})

test('no-sponsorship and citizenship wording is not penalised for such a profile, but still is for the owner', () => {
  const description = 'This is an entry-level role. We are unable to sponsor visas. Candidates must be U.S. citizens.'
  const citizen = kept({ description })
  assert.equal(citizen.breakdown.sponsor, 0)
  assert.equal(citizen.job.sponsorship_notes, null)
  const ownerResult = evaluatePosting(posting({ description, title: 'Security Engineer, New Grad 2027', location: 'Charlotte, NC' }), owner, NO_SPONSOR_DATA)
  assert.equal(ownerResult.kind, 'kept')
  if (ownerResult.kind === 'kept') assert.ok(ownerResult.breakdown.sponsor < 0)
})

test('clearance is a note, not a block, when sponsorship is not needed', () => {
  const description = 'This is an entry-level role. Requires an active Secret clearance.'
  assert.equal(evaluatePosting(posting({ description }), labProfile, NO_SPONSOR_DATA).kind, 'kept')
  assert.equal(evaluatePosting(posting({ description }), owner, NO_SPONSOR_DATA).kind, 'irrelevant')
  assert.match(kept({ description }).job.sponsorship_notes ?? '', /Clearance mentioned/)
})

test('skill matches and the employer watchlist add points, capped', () => {
  const plain = kept()
  assert.equal(plain.breakdown.skills, 4)
  assert.equal(plain.breakdown.employer, 0)
  const watched = kept({ company: 'Acme Bio, Inc.' })
  assert.equal(watched.breakdown.employer, 10)
  assert.equal(watched.job.match_score, plain.job.match_score + 10)
})

test('the profile\'s own graduation class counts as entry level', () => {
  const lab = kept({ title: 'Laboratory Technician, Class of 2026', description: 'Join us.' })
  assert.equal(lab.job.job_type, 'New Grad')
  const wrongYear = kept({ title: 'Laboratory Technician, Class of 2030', description: 'Join us.' })
  assert.ok(wrongYear.breakdown.level < lab.breakdown.level)
})

test('metroOnly drops US locations outside the listed metros but keeps remote', () => {
  assert.equal(scoreLocation('Boston, MA', labProfile).points, null)
  assert.equal(scoreLocation('Boston, MA', owner).points, 11)
  assert.equal(scoreLocation('Durham, NC', labProfile).points, 20)
  assert.equal(scoreLocation('Remote - US', labProfile).points, 4)
  assert.equal(evaluatePosting(posting({ location: 'Boston, MA' }), labProfile, NO_SPONSOR_DATA).kind, 'irrelevant')
})

test('the owner\'s scoring is unchanged by the optional profile settings', () => {
  const result = evaluatePosting(posting({ title: 'Cloud Security Engineer, New Grad 2027', location: 'Charlotte, NC', description: 'AWS and Terraform.' }), owner, NO_SPONSOR_DATA)
  assert.equal(result.kind, 'kept')
  if (result.kind === 'kept') {
    assert.equal(result.breakdown.skills, 0)
    assert.equal(result.breakdown.employer, 0)
    assert.doesNotMatch(result.job.notes, /skills|employer/)
  }
})

test('parseProfile accepts the owner profile and a no-sponsorship profile without sponsor tables', () => {
  assert.doesNotThrow(() => parseProfile(owner))
  const { sponsorTiers: _tiers, sponsorPoints: _points, ...withoutSponsor } = labProfile
  const parsed = parseProfile(withoutSponsor)
  assert.equal(parsed.sponsorPoints.strong, 0)
})

test('parseProfile names what is wrong', () => {
  assert.deepEqual(profileProblems(null), ['profile is not an object'])
  const { titleGroups: _groups, ...broken } = owner
  assert.match(profileProblems({ ...broken, graduation: 'May 2027' }).join('; '), /titleGroups.*graduation/)
  assert.throws(() => parseProfile({ ...owner, needsSponsorship: true, sponsorTiers: undefined }), /sponsorTiers/)
})
