import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Profile } from '../types.ts'
import { TECH_TERMS, buildVocabulary, resolveResume, retention, validateBase, validatePacket } from './packet.ts'
import { base, packet } from './test-fixtures.ts'

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
  assert.equal(read('../../supabase/functions/_shared/packet.ts'), read('packet.ts'))
})

test('numbers written as words are checked too', () => {
  const six = packet()
  six.experience[0].bullets[1].text = 'Built an access review tool in PowerShell that covered six identity platforms.'
  assert.match(check(six).errors.join(' '), /numbers not in the source: 6/)
  const three = packet()
  three.experience[0].bullets[1].text = 'Built an access review tool in PowerShell that covered three identity platforms.'
  assert.deepEqual(check(three).errors, [])
  const pronoun = packet()
  pronoun.cover_letter.paragraphs[0] = 'I am applying for the role, one I have wanted for a while.'
  assert.deepEqual(check(pronoun).errors, [])
})

test('coursework may back the cover letter and answers, never bullets or the summary', () => {
  const b = base()
  b.inventory = {
    tools: [],
    certifications: [],
    coursework: [{ code: 'ITIS 5166', title: 'Backend App Development', term: 'Fall 2025', status: 'completed', topics: ['REST APIs'], tools: ['MongoDB'] }],
  }
  assert.deepEqual(validateBase(b).errors, [])
  const run = (edit: (p: ReturnType<typeof packet>) => void) => {
    const input = packet()
    edit(input)
    return validatePacket(input, b, buildVocabulary(b)).errors.join(' ')
  }
  assert.equal(run((p) => { p.answers.why_role = 'In my ITIS 5166 course I built a MongoDB backend.' }), '')
  assert.equal(run((p) => { p.cover_letter.paragraphs[1] = 'In my Backend App Development course I used MongoDB.' }), '')
  assert.match(run((p) => { p.summary.text = 'Engineer who uses MongoDB and Azure.' }), /summary: tools\/skills not in the source: MongoDB/)
  assert.match(run((p) => { p.projects[0].bullets[0].text = 'Analyzed 475+ security events across 44 attack sessions in MongoDB.' }), /tools\/skills not in the source: MongoDB/)
  const broken = base()
  broken.inventory = { tools: [], certifications: [], coursework: [{ code: 'ITIS 5166' }] as never }
  assert.match(validateBase(broken).errors.join(' '), /inventory.coursework\[0\] must be/)
})

test('inventory.not_yet lists gaps and may not overlap the tools he claims', () => {
  const b = base()
  b.inventory = { tools: [{ name: 'Azure', depth: 'built', evidence: 'x' }], certifications: [], not_yet: [{ name: 'Kubernetes', note: 'never used' }] }
  assert.deepEqual(validateBase(b).errors, [])
  b.inventory.not_yet = [{ name: 'azure', note: '' }]
  assert.match(validateBase(b).errors.join(' '), /not_yet\[0\]: azure is also in inventory.tools/)
  b.inventory.not_yet = [{ name: 'Helm' }] as never
  assert.match(validateBase(b).errors.join(' '), /not_yet\[0\] must be \{ name, note \}/)
})

test('relevant coursework: inventory codes only, titles from the base, in-progress marked', () => {
  const b = base()
  b.inventory = {
    tools: [],
    certifications: [],
    coursework: [
      { code: 'ITCS 3160', title: 'Database Design and Implementation', term: 'Spring 2025', status: 'completed', topics: [], tools: ['MySQL'] },
      { code: 'ITIS 6167', title: 'Network Security', term: 'Fall 2026', status: 'in_progress', topics: [], tools: [] },
    ],
  }
  const run = (coursework: unknown) => validatePacket({ ...packet(), coursework }, b, buildVocabulary(b))
  const ok = run(['ITIS 6167', 'ITCS 3160'])
  assert.deepEqual(ok.errors, [])
  assert.deepEqual(resolveResume(ok.packet!, b).coursework, ['Network Security (in progress)', 'Database Design and Implementation'])
  assert.deepEqual(resolveResume(packet() as never, b).coursework, [])
  assert.match(run(['ITSC 9999']).errors.join(' '), /not in inventory.coursework: ITSC 9999/)
  assert.match(run(['ITCS 3160', 'ITCS 3160']).errors.join(' '), /twice/)
  assert.match(run(Array(7).fill('ITCS 3160')).errors.join(' '), /at most 6/)
})

test('qualifications: a met one cites a bullet in this packet or a section the resume has', () => {
  const withQualifications = (qualifications: unknown) => ({ ...packet(), qualifications })
  const good = [
    { text: 'Experience with Terraform', kind: 'basic', met: true, evidence: ['cloudsec:acme-intern:2'], note: '' },
    { text: "Bachelor's in Computer Science", kind: 'basic', met: true, evidence: ['education'], note: '' },
    { text: 'Kubernetes', kind: 'preferred', met: false, evidence: [], note: 'No Kubernetes experience.' },
  ]
  assert.deepEqual(check(withQualifications(good)).errors, [])
  const errors = (qualifications: unknown) => check(withQualifications(qualifications)).errors.join(' ')
  assert.match(errors([{ ...good[0], evidence: [] }]), /marked met but cites no evidence/)
  // A base bullet the packet didn't use isn't evidence, and neither is a section the resume doesn't have.
  assert.match(errors([{ ...good[0], evidence: ['cloud:acme-intern:2'] }]), /not a bullet in this packet/)
  assert.match(errors([{ ...good[0], evidence: ['certifications'] }]), /not a bullet in this packet/)
  assert.match(errors([{ ...good[0], kind: 'nice' }]), /must be \{ text, kind/)
  // Older packets without qualifications stay valid.
  assert.deepEqual(check(packet()).errors, [])
})

test('certifications come from the inventory: earned only, with a readable date', () => {
  const b = base()
  b.inventory = {
    tools: [],
    certifications: [
      { name: 'Example Job Simulation (Forage)', status: 'earned', date: '2025-01-06' },
      { name: 'Example Course Certificate', status: 'earned', date: '2022' },
      { name: 'CompTIA Security+', status: 'in_progress', date: null },
    ],
  }
  const resume = resolveResume(packet() as never, b)
  assert.deepEqual(resume.certifications, ['Example Job Simulation (Forage), Jan 2025', 'Example Course Certificate, 2022'])
  assert.deepEqual(resolveResume(packet() as never, base()).certifications, [])
})

test('contact.relocation is optional, and must be text when set', () => {
  const b = base()
  b.contact.relocation = 'Open to relocation'
  assert.deepEqual(validateBase(b).errors, [])
  b.contact.relocation = ''
  assert.match(validateBase(b).errors.join(' '), /contact.relocation/)
})

test('posting_text is optional text with a size limit', () => {
  assert.deepEqual(check({ ...packet(), posting_text: 'Requirements: Azure.' }).errors, [])
  assert.match(check({ ...packet(), posting_text: 'x'.repeat(20001) }).errors.join(' '), /posting_text must be at most/)
  assert.match(check({ ...packet(), posting_text: 42 }).errors.join(' '), /posting_text must be a non-empty string/)
})

