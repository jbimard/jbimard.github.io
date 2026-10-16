import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Profile } from '../types.ts'
import { TECH_TERMS, buildVocabulary, resolveResume, retention, validateBase, validatePacket, type BaseResumes, type BaseVersion } from './packet.ts'

// A made-up base; the real one is private and never in the repo.
const version = (key: string, dates: string): BaseVersion => ({
  summary: 'Cloud-focused engineer with a security background using Azure, Terraform and Splunk.',
  education: [{ school: 'Example University', location: 'Charlotte, NC', degrees: [{ degree: 'MS in Cybersecurity', date: 'May 2027' }] }],
  experience: [{
    id: 'acme-intern',
    org: 'Acme',
    location: 'Charlotte, NC',
    title: 'Security Intern',
    dates,
    bullets: [
      { id: `${key}:acme-intern:1`, text: 'Built an access review tool in PowerShell covering 3 identity platforms.' },
      { id: `${key}:acme-intern:2`, text: 'Provisioned identity infrastructure as Terraform across dev, staging and production.' },
    ],
  }],
  projects: [{
    id: 'honeypot',
    name: 'SSH Honeypot with Splunk',
    context: 'GitHub',
    bullets: [{ id: `${key}:honeypot:1`, text: 'Analyzed 475+ security events across 44 attack sessions in Splunk.' }],
  }],
  skills: [{ id: `${key}:tools`, label: 'Tools', items: ['Azure', 'Terraform', 'Splunk', 'PowerShell'] }],
})

const base = (): BaseResumes => ({
  contact: { name: 'Test Person', location: 'Charlotte, NC', email: 'test@example.com', phone: '000-000-0000', links: ['example.com'] },
  workAuthorization: [{ question: 'Authorized to work in the US?', answer: 'Yes.' }],
  versions: { 'Cloud': version('cloud', 'May 2026 – Aug 2026'), 'Security': version('sec', 'May 2026 – Present'), 'Cloud Security': version('cloudsec', 'May 2026 – Aug 2026') },
})

const packet = () => ({
  job_id: '0b6f2a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  resume_version: 'Cloud Security',
  summary: { text: 'Security-minded cloud engineer who builds identity tooling with Azure and Terraform.' },
  experience: [{
    id: 'acme-intern',
    bullets: [
      { from: 'cloudsec:acme-intern:2', text: 'Provisioned identity infrastructure as Terraform across dev, staging and production environments.' },
      { from: 'cloud:acme-intern:1', text: 'Built an access review tool in PowerShell that covered 3 identity platforms.' },
    ],
  }],
  projects: [{ id: 'honeypot', bullets: [{ from: 'sec:honeypot:1', text: 'Analyzed 475+ security events across 44 attack sessions using Splunk.' }] }],
  skills: [{ id: 'cloudsec:tools', items: ['terraform', 'Azure', 'Splunk'] }],
  cover_letter: { paragraphs: ['I am applying for the role.', 'At Acme I built identity tooling in PowerShell and Terraform.', 'Thank you for your time.'] },
  answers: { why_company: 'The posting focuses on cloud identity.', why_role: 'It matches my Azure work.', relevant_project: 'The Splunk honeypot.', anything_else: '' },
  match_report: { coverage: 70, covered: ['Terraform', 'Azure'], gaps: [{ keyword: 'Kubernetes', addable: false, note: 'No Kubernetes experience.' }] },
})

const check = (input: unknown, jobSkills: string[] = ['Kubernetes', 'AWS']) => {
  const b = base()
  return validatePacket(input, b, buildVocabulary(b, jobSkills))
}

test('the made-up base is valid, and a broken one is reported', () => {
  assert.deepEqual(validateBase(base()).errors, [])
  const broken = base() as unknown as { versions: Record<string, unknown> }
  delete broken.versions.Security
  assert.match(validateBase(broken).errors.join(' '), /versions\["Security"\] is missing/)
})

test('a truthful packet passes with no warnings', () => {
  const { packet: result, errors, warnings } = check(packet())
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
  assert.ok(result)
})

test('locked fields come from the base, skill spelling too', () => {
  const resume = resolveResume(check(packet()).packet!, base())
  assert.equal(resume.contact.name, 'Test Person')
  assert.equal(resume.experience[0].heading, 'Acme, Charlotte, NC')
  assert.equal(resume.experience[0].subheading, 'Security Intern')
  assert.equal(resume.experience[0].right, 'May 2026 – Aug 2026')
  assert.equal(resume.projects[0].right, 'GitHub')
  assert.deepEqual(resume.skills[0], { label: 'Tools', items: ['Terraform', 'Azure', 'Splunk'] })
})

test('a changed number is blocked', () => {
  const input = packet()
  input.projects[0].bullets[0].text = 'Analyzed 500+ security events across 44 attack sessions using Splunk.'
  assert.match(check(input).errors.join(' '), /numbers not in the source: 500/)
})

test('a tool the source bullet never mentions is blocked, even one the posting asks for', () => {
  const input = packet()
  input.experience[0].bullets[0].text = 'Provisioned identity infrastructure with Terraform and Kubernetes across dev, staging and production.'
  assert.match(check(input).errors.join(' '), /tools\/skills not in the source: Kubernetes/)
  // Splunk is a real skill, but not in this bullet's source.
  input.experience[0].bullets[0].text = 'Provisioned identity infrastructure as Terraform across dev, staging and production, with Splunk.'
  assert.match(check(input).errors.join(' '), /not in the source: Splunk/)
})

test('unknown ids and borrowed bullets are blocked', () => {
  const input = packet()
  input.experience[0].id = 'made-up-job'
  assert.match(check(input).errors.join(' '), /unknown experience id "made-up-job"/)
  const borrowed = packet()
  borrowed.experience[0].bullets[0].from = 'sec:honeypot:1'
  assert.match(check(borrowed).errors.join(' '), /must be a base bullet id of "acme-intern"/)
})

test('skills must already be in the base', () => {
  const input = packet()
  input.skills[0].items.push('AWS')
  assert.match(check(input).errors.join(' '), /not in the base skills: AWS/)
})

test('the cover letter and answers cannot name tools or numbers the base lacks', () => {
  const input = packet()
  input.cover_letter.paragraphs[1] = 'I have 5 years of AWS experience.'
  const errors = check(input).errors.join(' ')
  assert.match(errors, /cover_letter: numbers not in the source: 5/)
  assert.match(errors, /cover_letter: tools\/skills not in the source: AWS/)
  const answer = packet()
  answer.answers.why_role = 'I love Kubernetes.'
  assert.match(check(answer).errors.join(' '), /answers.why_role: tools\/skills not in the source: Kubernetes/)
})

test('ordinary words are not mistaken for product names', () => {
  const input = packet()
  input.cover_letter.paragraphs[0] = 'I am ready to go and keep the work elastic.'
  assert.deepEqual(check(input).errors, [])
})

test('heavy rewording and em dashes are warnings, not errors', () => {
  const input = packet()
  input.experience[0].bullets[1].text = 'Created software that reviews who holds access in PowerShell for 3 platforms — fast — and safe — always.'
  const { errors, warnings } = check(input)
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings.map((warning) => warning.path), ['experience[0].bullets[1]', '*'])
  assert.ok(retention('totally different words here', 'Built an access review tool') < 0.5)
})

test('limits and required fields', () => {
  const input = { ...packet(), resume_version: 'Data', match_report: { coverage: 101, covered: [], gaps: [] } }
  assert.match(check(input).errors.join(' '), /resume_version must be one of/)
  const coverage = { ...packet(), match_report: { coverage: 101, covered: [], gaps: [] } }
  assert.match(check(coverage).errors.join(' '), /coverage must be an integer/)
  const short = packet()
  short.cover_letter.paragraphs = ['Only one.']
  assert.match(check(short).errors.join(' '), /paragraphs must have 3–5 items/)
})

test('TECH_TERMS covers every discovery profile skill', () => {
  const profile = JSON.parse(readFileSync(path.join(import.meta.dirname, '../config/profile.json'), 'utf8')) as Profile
  assert.deepEqual(profile.skills.filter((skill) => !TECH_TERMS.includes(skill)), [])
})

test('the Edge Function copy is identical', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')
  assert.equal(read('../../supabase/functions/job-prep/packet.ts'), read('packet.ts'))
})
