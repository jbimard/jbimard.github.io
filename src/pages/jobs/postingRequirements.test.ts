import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TECH_TERMS } from '../../../supabase/functions/_shared/packet.ts'
import { extractRequirements, yearsSummary } from './postingRequirements.ts'

const POSTING = `About the role
We are building the detection platform for our cloud customers. Our team is based in Raleigh, NC.

What you'll do
• Build detections in Splunk and CrowdStrike Falcon.
• Triage alerts with the SOC Lead.

Minimum qualifications
• Bachelor's degree in Computer Science or a related field, or equivalent experience.
• 0-2 years of experience in security operations or cloud engineering.
• Hands-on experience with AWS IAM, Terraform and Python.
• Working knowledge of Wiz, Snyk and OpenTelemetry.
• Familiarity with GRC frameworks such as NIST CSF.
• Security+ or AWS Certified Security Specialty.

Preferred qualifications
• Master's degree in Cybersecurity.
• CISSP or CKA is a plus.
• Experience with Kubernetes and Falco.

Work authorization
Applicants must be authorized to work in the US without the need for current or future sponsorship. This role may require U.S. citizenship. We participate in E-Verify.`

const result = extractRequirements(POSTING, TECH_TERMS)

test('requirements are split by section: basic under qualifications, preferred under the preferred heading, nothing from responsibilities', () => {
  assert.equal(result.basic.length, 6)
  assert.equal(result.preferred.length, 3)
  assert.ok(result.basic.every((requirement) => !/Triage alerts/.test(requirement.text)))
  assert.ok(result.preferred.some((requirement) => /Kubernetes and Falco/.test(requirement.text)))
})

test('years: ranges and plus signs, from basic requirements only', () => {
  assert.deepEqual(result.years.map((entry) => [entry.min, entry.max]), [[0, 2]])
  assert.equal(yearsSummary(result.years), '0–2 years')
  assert.deepEqual(extractRequirements('Requirements\n• 3+ years of experience with Linux.\n• five years of Python', []).years.map((e) => [e.min, e.max]), [[3, null], [5, 5]])
  assert.equal(yearsSummary(extractRequirements('Requirements\n• 3+ years of Linux', []).years), '3+ years')
  assert.equal(yearsSummary([]), null)
})

test('degrees: level, "or equivalent experience", and a master\'s that is only preferred', () => {
  assert.deepEqual(result.degrees.map((entry) => [entry.level, entry.orEquivalent]), [['bachelor', true], ['master', false]])
})

test('certifications: named ones, split by required and preferred', () => {
  assert.deepEqual(result.certifications, [
    { name: 'Security+', kind: 'basic' },
    { name: 'AWS Certified Security Specialty', kind: 'basic' },
    { name: 'CISSP', kind: 'preferred' },
    { name: 'CKA', kind: 'preferred' },
  ])
})

test('work authorization: no sponsorship, citizenship and E-Verify are quoted', () => {
  assert.deepEqual(result.eligibility.map((entry) => entry.kind), ['no_sponsorship', 'citizenship', 'e_verify'])
  assert.match(result.eligibility[0].text, /without the need for current or future sponsorship/)
  assert.deepEqual(extractRequirements('We offer visa sponsorship for this role.', []).eligibility.map((e) => e.kind), ['sponsorship_offered'])
  assert.deepEqual(extractRequirements('This employer does not offer visa sponsorship.', []).eligibility.map((e) => e.kind), ['no_sponsorship'])
  assert.deepEqual(extractRequirements('Active TS/SCI clearance required.', []).eligibility.map((e) => e.kind), ['clearance'])
})

test('new terms: tools missing from the known list are found; known ones, degrees and furniture are not', () => {
  assert.ok(result.newTerms.includes('Falco'), result.newTerms.join(', '))
  assert.ok(result.newTerms.includes('GRC'))
  assert.ok(result.newTerms.includes('OpenTelemetry') === false, 'OpenTelemetry is in TECH_TERMS')
  for (const known of ['Wiz', 'Snyk', 'Terraform', 'Python', 'Kubernetes', 'Security+', 'CISSP', 'AWS IAM']) assert.ok(!result.newTerms.includes(known), `${known} should not be new`)
  for (const noise of ['Bachelor', 'Computer Science', 'Experience', 'Familiarity', 'Cybersecurity']) assert.ok(!result.newTerms.includes(noise), `${noise} should not be new`)
})

test('a posting with no headings still finds requirements by their wording', () => {
  const plain = extractRequirements('Join us to secure our cloud. You need a bachelor\'s degree and 2+ years of experience with Okta. Knowledge of Tailscale is a plus. We love dogs.', TECH_TERMS)
  assert.equal(plain.basic.length, 1)
  assert.equal(plain.preferred.length, 1)
  assert.deepEqual(plain.years.map((e) => e.min), [2])
  assert.ok(plain.newTerms.includes('Tailscale'))
})

test('empty text gives an empty result', () => {
  assert.deepEqual(extractRequirements('', []), { basic: [], preferred: [], years: [], degrees: [], certifications: [], eligibility: [], newTerms: [] })
})

// Problems seen on real Greenhouse postings (2026-11-11): "10+" read as a tool, "B.S." missed, a benefits paragraph after the
// requirement bullets counted as a requirement, the company's own name offered as a new term, Security+ listed twice.
test('real-posting regressions', () => {
  const text = `Qualifications
• B.S. in Computer Science or equivalent experience with 10+ years building production software
• Experience with Pendo, Vanta and Drata; CompTIA Security+ or Security+ preferred
EPIC JOB + EPIC BENEFITS = EPIC LIFE
Our intent is to cover all things that are medically necessary and improve the quality of life. We offer Medical, Dental, a Vision HRA and Modern Health.`
  const found = extractRequirements(text, [], ['Pendo'])
  assert.deepEqual(found.degrees.map((entry) => [entry.level, entry.orEquivalent]), [['bachelor', true]])
  assert.ok(!found.newTerms.some((term) => /^\d/.test(term)), found.newTerms.join(', '))
  assert.ok(found.newTerms.includes('Vanta') && found.newTerms.includes('Drata'))
  assert.ok(!found.newTerms.includes('Pendo'))
  assert.ok(!found.newTerms.includes('Modern Health') && !found.newTerms.includes('Medical'))
  assert.deepEqual([found.basic.length, found.preferred.length], [1, 1])
  assert.deepEqual(found.certifications.map((cert) => cert.name), ['CompTIA Security+'])
  assert.deepEqual(extractRequirements('Requirements\n• MS in Cybersecurity or M.S. in a related field', []).degrees.map((d) => d.level), ['master'])
  assert.deepEqual(extractRequirements('Requirements\n• Proficient in MS Office', []).degrees, [])
})
