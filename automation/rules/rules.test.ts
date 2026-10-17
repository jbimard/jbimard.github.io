import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Profile, RawPosting } from '../types.ts'
import { detectFlags, entryLevelTitle } from './flags.ts'
import { evaluatePosting, titleGroup } from './score.ts'
import { NO_SPONSOR_DATA, type SponsorRecord } from './sponsors.ts'
import { htmlToText, parseAnnualSalary, scoreLocation, shortLocation } from './text.ts'

const profile = JSON.parse(readFileSync(path.join(import.meta.dirname, '../config/profile.json'), 'utf8')) as Profile

const posting = (overrides: Partial<RawPosting> = {}): RawPosting => ({
  source: 'test',
  company: 'Acme',
  title: 'Cloud Security Engineer, New Grad 2027',
  url: 'https://example.com/jobs/1',
  location: 'Charlotte, NC',
  description: 'Build secure AWS infrastructure with Terraform and Python.',
  workplaceHint: null,
  salaryText: null,
  simplifySponsorship: null,
  ...overrides,
})

// A company with 50+ USCIS New Employment approvals; NO_SPONSOR_DATA is the "none on record" tier.
const strongSponsor: SponsorRecord = { ...NO_SPONSOR_DATA, tier: 'strong', fiscalYear: 2025, count: 212, matchedNames: ['ACME INC'] }
const evaluate = (overrides: Partial<RawPosting>, sponsor: SponsorRecord = NO_SPONSOR_DATA) => evaluatePosting(posting(overrides), profile, sponsor)

const evaluateKept = (overrides: Partial<RawPosting>, sponsor: SponsorRecord = NO_SPONSOR_DATA) => {
  const result = evaluate(overrides, sponsor)
  assert.equal(result.kind, 'kept')
  return result
}

test('clearance is the one hard block', () => {
  for (const description of [
    'Candidates must have an active Secret clearance.',
    'Requires TS/SCI with polygraph.',
    'Must be able to obtain and maintain a security clearance.',
  ]) {
    assert.equal(evaluate({ description }).kind, 'blocked', description)
  }
  assert.equal(evaluate({ title: 'Security Engineer - Top Secret Clearance Required' }).kind, 'blocked')
  assert.equal(evaluate({ description: 'No security clearance required for this role.' }).kind, 'kept')
  assert.equal(evaluate({ description: 'This role may require a security clearance at the TS/SCI level.' }).kind, 'blocked')
  // EEO footers cite the Employee Polygraph Protection Act, a law that limits polygraphs; it isn't a clearance.
  assert.equal(evaluate({ description: 'Click these links to view the following notices: "EEOC Know Your Rights" and "Employee Polygraph Protection Act".' }).kind, 'kept')
  assert.equal(evaluate({ description: 'Requires TS/SCI with full-scope polygraph. See the Employee Polygraph Protection Act notice.' }).kind, 'blocked')
})

test('conditional clearance wording is labeled, not blocked', () => {
  const result = evaluateKept({ description: 'Depending on work location, may be required to obtain a security clearance for site access.' })
  if (result.kind !== 'kept') return
  assert.match(result.job.sponsorship_notes ?? '', /Clearance possibly required/)
})

test('roles with no entry-level signal score low on level and do not get a pay boost', () => {
  const result = evaluateKept({ title: 'Security Engineer, Detection', salaryText: '$300,000 - $400,000' })
  if (result.kind !== 'kept') return
  // Level 3 and capped pay 7, then the whole score is scaled by noLevelSignalFactor (0.8).
  assert.deepEqual(
    { role: result.breakdown.role, level: result.breakdown.level, pay: result.breakdown.pay },
    { role: 24, level: 2, pay: 6 },
  )
  assert.equal(result.job.job_type, 'Other')
  assert.match(result.job.notes, /no level signal ×0.8/)
})

test('citizenship requirements are kept, labeled and penalized', () => {
  const plain = evaluateKept({})
  const flagged = evaluateKept({ description: 'Applicants must be U.S. citizens due to export control regulations.' })
  if (plain.kind !== 'kept' || flagged.kind !== 'kept') return
  assert.match(flagged.job.sponsorship_notes ?? '', /Citizenship stated/)
  assert.equal(plain.breakdown.sponsor - flagged.breakdown.sponsor, 20)
})

test('EEO boilerplate about citizenship status is not a requirement', () => {
  const flags = detectFlags(posting({
    description: 'We do not discriminate on the basis of race, religion, citizenship status, or any other protected characteristic.',
  }))
  assert.equal(flags.citizenship, null)
})

test('no-sponsorship postings are kept with a label', () => {
  const result = evaluateKept({
    description: 'Candidates must be authorized to work in the US without the need for current or future visa sponsorship.',
  }, strongSponsor)
  if (result.kind !== 'kept') return
  assert.match(result.job.sponsorship_notes ?? '', /No sponsorship/)
  assert.equal(result.breakdown.sponsor, -5) // strong 25 − 30
  const unknown = evaluateKept({ description: 'We are unable to sponsor visas for this role.' })
  if (unknown.kind === 'kept') assert.equal(unknown.breakdown.sponsor, -25) // none on record 5 − 30
})

test('Simplify sponsorship labels feed the same flags', () => {
  assert.ok(detectFlags(posting({ description: null, simplifySponsorship: 'U.S. Citizenship is Required' })).citizenship)
  assert.ok(detectFlags(posting({ description: null, simplifySponsorship: 'Does Not Offer Sponsorship' })).noSponsorship)
  assert.ok(detectFlags(posting({ description: null, simplifySponsorship: 'Offers Sponsorship' })).sponsorshipOffered)
})

test('internships are kept in their own lane', () => {
  const result = evaluateKept({ title: 'Security Engineering Intern - Summer 2027' })
  if (result.kind !== 'kept') return
  assert.equal(result.job.job_type, 'Internship')
  assert.equal(result.breakdown.level, 15)
})

test('internships requiring a return to school are held under the cutoff with the reason', () => {
  const result = evaluateKept({
    title: 'Cloud Engineering Intern',
    description: 'Candidates must be returning to school in the fall following the internship.',
  }, strongSponsor)
  assert.equal(result.breakdown.level, 5)
  assert.ok(result.job.match_score < profile.minScore)
  assert.match(result.job.notes ?? '', /requires returning to school after the internship/)
  // Cisco's wording, with "in a degree program" in the middle.
  const cisco = evaluateKept({
    title: 'Software Engineer I (Intern)',
    description: 'You are currently enrolled and expected to continue enrollment in a degree program after the internship.',
  }, strongSponsor)
  assert.ok(cisco.flags.returnToSchool)
  assert.ok(cisco.job.match_score < profile.minScore)
  const following = evaluateKept({ title: 'AI Operations Engineer I (Intern)', description: 'Expected to continue enrollment in degree program following completion of the internship.' }, strongSponsor)
  assert.ok(following.job.match_score < profile.minScore)
  // A co-op that ends before his last semester still works.
  const fall = evaluateKept({ title: 'Security Co-op - Fall 2026', description: 'Students must return to school after the co-op.' }, strongSponsor)
  assert.ok(fall.job.match_score >= profile.minScore)
})

test('seniority and irrelevant titles are dropped, not blocked', () => {
  for (const title of ['Security and Derivatives Intermediate Associate Analyst', 'Trader Voice Engineer', 'Senior Security Engineer', 'Sr. Cloud Engineer', 'Staff SRE', 'Software Engineer II', 'Security Officer', 'Account Executive']) {
    assert.equal(titleGroup(title, profile), null, title)
  }
  assert.equal(titleGroup('Technology Leadership Development Program', profile), 'B')
  assert.equal(titleGroup('Data & Technology Track Associate - Rotational Program', profile), 'B')
  assert.equal(titleGroup('2027 Early Talent Rotational Program: Retirement Solutions - Licensed', profile), null)
  assert.equal(titleGroup('Finance Rotational Program', profile), null)
  assert.equal(titleGroup('Cloud Security Engineer', profile), 'A')
  assert.equal(titleGroup('Site Reliability Engineer', profile), 'B')
  assert.equal(titleGroup('Software Engineer, New Grad', profile), 'C')
  assert.equal(evaluate({ description: 'Requires 5+ years of professional experience.' }).kind, 'irrelevant')
})

test('location scoring prefers Charlotte/Triangle, then Boston/NYC, then remote US', () => {
  assert.equal(scoreLocation('Charlotte, NC', profile).points, 15)
  assert.equal(scoreLocation('Austin, TX; Cary, NC', profile).points, 15)
  assert.equal(scoreLocation('New York, NY', profile).points, 11)
  assert.equal(scoreLocation('Remote (US)', profile).points, 9)
  assert.equal(scoreLocation('Remote', profile).points, 9)
  assert.equal(scoreLocation('Austin, TX', profile).points, 3)
  assert.equal(scoreLocation('Hyderabad, IN', profile).points, null)
  assert.equal(scoreLocation('Remote - Canada', profile).points, null)
  assert.equal(scoreLocation('London, UK', profile).points, null)
})

test('title fit scales the other points so unrelated roles sink', () => {
  const base = { location: 'New York, NY', salaryText: '$60/hr' }
  const security = evaluateKept({ ...base, title: 'Cloud Security Intern' }, strongSponsor)
  const generic = evaluateKept({ ...base, title: 'Software Engineer Intern' }, strongSponsor)
  const offTarget = evaluateKept({ ...base, title: 'Analytics Engineer Intern' }, strongSponsor)
  if (security.kind !== 'kept' || generic.kind !== 'kept' || offTarget.kind !== 'kept') return
  assert.equal(security.breakdown.fit, 1)
  assert.equal(generic.breakdown.fit, 0.75)
  assert.equal(offTarget.breakdown.fit, 0.5)
  assert.ok(security.job.match_score > generic.job.match_score)
  assert.ok(generic.job.match_score > offTarget.job.match_score)
  assert.ok(offTarget.job.match_score < profile.minScore)
  // A security title is never off-target, even with "AI" in it.
  const ai = evaluateKept({ ...base, title: 'AI Security Engineer' }, strongSponsor)
  if (ai.kind === 'kept') assert.equal(ai.breakdown.fit, 1)
})

test('short location shows the best-scoring city plus a count', () => {
  assert.equal(shortLocation('Spring, Texas, United States of America; Durham, North Carolina, United States of America; San Jose, CA', profile), 'Durham, North Carolina +2 more')
  assert.equal(shortLocation('Charlotte, NC', profile), 'Charlotte, NC')
})

test('salary parsing handles ranges, k-suffixes, hourly and ignores company size', () => {
  assert.equal(parseAnnualSalary('The base salary range is $100,000 - $140,000 per year.'), 120_000)
  assert.equal(parseAnnualSalary('$211.4K – $290.6K • Offers Equity'), 251_000)
  assert.equal(parseAnnualSalary('Pay: $40/hr'), 83_200)
  assert.equal(parseAnnualSalary('We raised $100M from investors. Salary $90k'), 90_000)
  assert.equal(parseAnnualSalary('No pay info'), null)
})

test('score adds up to the breakdown and maps to priority', () => {
  const result = evaluateKept({ salaryText: '$130,000 - $150,000' }, strongSponsor)
  if (result.kind !== 'kept') return
  const { role, sponsor, level, location, pay } = result.breakdown
  assert.deepEqual({ role, sponsor, level, location, pay }, { role: 30, sponsor: 25, level: 15, location: 15, pay: 15 })
  assert.equal(result.breakdown.fit, 1)
  assert.equal(result.job.match_score, 100)
  assert.equal(result.job.priority, 'High')
  // Discovery only fills the queue; the daily batch (or "Next batch") moves rows to Found.
  assert.equal(result.job.status, 'Queued')
})

test('html is decoded, including Greenhouse double-escaping', () => {
  assert.equal(htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;AWS&lt;/li&gt;&lt;/ul&gt;'), 'Hello & welcome\n• AWS')
})

test('graduation windows that exclude May 2027 stay under the cutoff, with a note', () => {
  const marvell = evaluateKept({
    title: 'AI-Native Development Platform Engineer Intern, MS - Summer 2027',
    description: 'Currently pursuing a Master\'s Degree in Computer Science with an expected graduation date between Fall 2027 – Summer 2028. Python, CI/CD, Docker.',
  }, strongSponsor)
  assert.ok(marvell.job.match_score < profile.minScore)
  assert.match(marvell.job.notes ?? '', /graduation window excludes 2027-05/)
  assert.equal(marvell.breakdown.level, 0)

  // Windows that include May 2027 are fine.
  for (const description of [
    'Open to students with an expected graduation between December 2026 and August 2027.',
    'Candidates graduating in Spring 2027.',
    'Must graduate by June 2027.',
    'Class of 2027 graduates.',
  ]) {
    const kept = evaluateKept({ description }, strongSponsor)
    assert.ok(!(kept.job.notes ?? '').includes('graduation window'), description)
  }
  // Tanium lists the later date first.
  const tanium = evaluateKept({ title: 'Cloud Security Intern', description: 'Currently enrolled Bachelors degree candidate. Graduating Spring 2028 or Fall 2027.' }, strongSponsor)
  assert.match(tanium.job.notes ?? '', /graduation window excludes/)
  const either = evaluateKept({ description: 'Graduating Fall 2027 or Spring 2027.' }, strongSponsor)
  assert.ok(!(either.job.notes ?? '').includes('graduation window'))
  const late = evaluateKept({ description: 'For students graduating in December 2027.' }, strongSponsor)
  assert.ok(late.job.match_score < profile.minScore)
})

test('internships that start after May 2027 are held under the cutoff; the term can come from the description', () => {
  const summer = evaluateKept({ title: 'Cloud Security Intern - Summer 2027', description: 'Build secure AWS infrastructure.' }, strongSponsor)
  assert.ok(summer.job.match_score < profile.minScore)
  assert.match(summer.job.notes ?? '', /internship starts after the 2027-05 graduation, so it needs current enrollment/)
  const yearFirst = evaluateKept({ title: '2027 IT Summer Intern - Systems Engineer', description: 'Build secure AWS infrastructure.' }, strongSponsor)
  assert.ok(yearFirst.job.match_score < profile.minScore)
  const described = evaluateKept({ title: 'Cloud Security Intern', description: 'Join our Summer 2027 internship program. Build secure AWS infrastructure.' }, strongSponsor)
  assert.ok(described.job.match_score < profile.minScore)
  // A year elsewhere in the posting isn't the internship's term.
  const other = evaluateKept({ title: 'Cloud Security Intern', description: 'Founded in 2028? No: we plan our Fall 2027 roadmap now.' }, strongSponsor)
  assert.ok(!(other.job.notes ?? '').includes('internship starts after'))
  const spring = evaluateKept({ title: 'Cloud Security Intern - Spring 2027', description: 'Build secure AWS infrastructure.' }, strongSponsor)
  assert.ok(!(spring.job.notes ?? '').includes('internship starts after'))
  assert.ok(spring.job.match_score >= profile.minScore)
  // With a window that excludes May 2027 it's filtered, and only the window note shows.
  const stated = evaluateKept({ title: 'Cloud Security Intern - Summer 2027', description: 'Graduating Spring 2028 or Fall 2027.' }, strongSponsor)
  assert.ok(stated.job.match_score < profile.minScore)
  assert.ok(!(stated.job.notes ?? '').includes('internship starts after'))
})


test('"Engineer I" in a title is an entry-level signal; "I" in a description and "Engineer II" are not', () => {
  const blank = { description: 'Join our team.' }
  assert.equal(detectFlags(posting({ ...blank, title: 'Site Reliability Engineer I (Full Time)' })).newGradSignal, true)
  assert.equal(detectFlags(posting({ ...blank, title: 'Software Engineer 1 - Backend' })).newGradSignal, true)
  assert.equal(detectFlags(posting({ ...blank, title: 'Software Engineer II' })).newGradSignal, false)
  assert.equal(detectFlags(posting({ ...blank, title: 'Software Engineer 10x Platform' })).newGradSignal, false)
  assert.equal(detectFlags(posting({ title: 'Cloud Engineer', description: 'As an engineer I will mentor you.' })).newGradSignal, false)
})

test('entry-level titles are recognized before the description is fetched, so they win the per-company detail cap', () => {
  for (const title of ['Site Reliability Engineer I', 'Cloud Engineer - New College Grad 2027', 'Entry Level Application Engineer', 'Security Intern', 'Software Engineer Co-op', 'Cloud Engineer Graduate']) {
    assert.equal(entryLevelTitle(title), true, title)
  }
  for (const title of ['Cloud Security Engineer', 'Software Engineer II', 'Associate, Software Engineer']) assert.equal(entryLevelTitle(title), false, title)
})
