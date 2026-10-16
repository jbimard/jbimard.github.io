import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { LAYOUT, checkPacket, estimateResumeHeight, postingKeywords, wordDiff, type PostingFields } from './check.ts'
import { numbersIn, resolveResume, type BaseResumes, type Inventory, type Packet } from './packet.ts'
import { base as fixtureBase, packet as fixturePacket } from './test-fixtures.ts'

const inventory = (): Inventory => ({
  tools: [
    { name: 'Azure', depth: 'built', evidence: 'cloud:acme-intern:2' },
    { name: 'Terraform', depth: 'built', evidence: 'cloud:acme-intern:2' },
    { name: 'PowerShell', depth: 'built', evidence: 'cloud:acme-intern:1' },
    { name: 'Splunk', depth: 'used', evidence: 'sec:honeypot:1' },
  ],
  certifications: [],
})
const withInventory = (patch: Partial<Inventory> = {}): BaseResumes => ({ ...fixtureBase(), inventory: { ...inventory(), ...patch } })
const noJob: PostingFields = { required_skills: null, job_description: null }

const run = (edit: (p: ReturnType<typeof fixturePacket>) => void = () => {}, base = withInventory(), job = noJob) => {
  const p = fixturePacket()
  edit(p)
  return checkPacket(p as Packet, base, resolveResume(p as Packet, base), job)
}
const rules = (result: ReturnType<typeof run>) => result.flags.map((flag) => `${flag.severity}:${flag.rule}`)

test('a truthful, plainly written packet passes', () => {
  const result = run()
  assert.deepEqual(result.flags, [])
  assert.equal(result.status, 'pass')
  assert.equal(result.comparisons.length, 3)
  assert.equal(result.comparisons[1].source, 'Built an access review tool in PowerShell covering 3 identity platforms.')
})

test('raising the lead verb above the source is red; keeping or lowering it is fine', () => {
  const led = run((p) => { p.experience[0].bullets[1].text = 'Led the build of an access review tool in PowerShell covering 3 identity platforms.' })
  assert.equal(led.status, 'blocked')
  assert.ok(rules(led).includes('red:verb_inflation'))

  const base = withInventory()
  base.versions['Cloud Security'].experience[0].bullets.push({ id: 'cloudsec:acme-intern:3', text: 'Assisted the team with Splunk alert reviews.' })
  const add = (text: string) => run((p) => { p.experience[0].bullets.push({ from: 'cloudsec:acme-intern:3', text }) }, base)
  assert.deepEqual(rules(add('Supported the team with Splunk alert reviews.')), [])
  assert.ok(rules(add('Built Splunk alert reviews for the team.')).includes('red:verb_inflation'))
  // "Architected" from "Re-architected" is the same level of work.
  base.versions['Cloud Security'].experience[0].bullets.push({ id: 'cloudsec:acme-intern:4', text: 'Re-architected the Terraform layout for staging.' })
  const architected = run((p) => { p.experience[0].bullets.push({ from: 'cloudsec:acme-intern:4', text: 'Architected the Terraform layout for staging.' }) }, base)
  assert.ok(!rules(architected).includes('red:verb_inflation'))
})

test('expert claims: red for a tool only "used", yellow for "built with"', () => {
  assert.ok(rules(run((p) => { p.summary.text = 'Cloud engineer with expert knowledge of Splunk.' })).includes('red:level_inflation'))
  const terraform = run((p) => { p.summary.text = 'Cloud engineer and Terraform expert, with expertise in Terraform.' })
  assert.ok(rules(terraform).includes('yellow:level_claim'))
  assert.ok(!rules(terraform).includes('red:level_inflation'))
  assert.ok(!rules(run((p) => { p.summary.text = 'Cloud engineer who has used advanced hunting in Splunk.' })).some((rule) => rule.includes('level')))
})

test('tools missing from the inventory are red', () => {
  const result = run(() => {}, withInventory({ tools: inventory().tools.filter((tool) => tool.name !== 'PowerShell') }))
  assert.equal(result.status, 'blocked')
  assert.ok(result.flags.some((flag) => flag.rule === 'tool_not_in_inventory' && flag.message.includes('PowerShell')))
})

test('certifications must be earned; in-progress ones must say so', () => {
  assert.deepEqual(rules(run((p) => { p.cover_letter.paragraphs[2] = 'I also hold the CISSP.' })), ['red:certification'])
  const base = withInventory({ certifications: [{ name: 'CompTIA Security+', status: 'in_progress', date: null }, { name: 'AZ-900', status: 'earned', date: '2026-05-01' }] })
  assert.deepEqual(rules(run((p) => { p.answers.anything_else = 'Security+ expected by May 2027; AZ-900 earned.' }, base)), [])
  assert.ok(rules(run((p) => { p.answers.anything_else = 'I have Security+.' }, base)).includes('red:certification'))
})

test('without an inventory the packet needs a look, not a block', () => {
  const result = run(() => {}, fixtureBase())
  assert.deepEqual(rules(result), ['yellow:no_inventory'])
  assert.equal(result.status, 'needs_edits')
})

test('generated-sounding writing is yellow', () => {
  const buzz = run((p) => { p.cover_letter.paragraphs[1] = 'At Acme I leveraged PowerShell to build robust identity tooling.' })
  assert.deepEqual(rules(buzz).filter((rule) => rule === 'yellow:buzzword').length, 2)
  assert.ok(rules(run((p) => { p.summary.text = 'Engineer — cloud — identity — Azure.' })).includes('yellow:em_dashes'))
  assert.ok(rules(run((p) => { p.answers.why_role = 'It covers various areas of Azure.' })).includes('yellow:vague'))
  assert.ok(rules(run((p) => { p.answers.relevant_project = 'I led the identity work at Acme.' })).includes('yellow:leadership_claim'))
  const same = run((p) => {
    p.experience[0].bullets[0].text = 'Built identity infrastructure as Terraform across dev, staging and production.'
    p.projects[0].bullets[0].text = 'Built analysis of 475+ security events across 44 attack sessions in Splunk.'
  })
  assert.ok(rules(same).includes('yellow:repetitive'))
})

test('locked fields that drift from the base are red', () => {
  const base = withInventory()
  const p = fixturePacket() as Packet
  const resume = resolveResume(p, base)
  resume.experience[0].right = 'May 2025 – Aug 2026'
  assert.ok(checkPacket(p, base, resume, noJob).flags.some((flag) => flag.rule === 'locked_fields' && flag.severity === 'red'))
})

const POSTING = `About the role
We build secure cloud systems.
Requirements:
• Experience with Azure and Terraform
• Familiarity with Kubernetes
• GPA of 3.2 or higher preferred
Preferred qualifications
• Splunk or other SIEM tools
• AWS`

test('posting keywords are split by section heading, not by stray words in bullets', () => {
  const { required, preferred } = postingKeywords(POSTING, ['AWS', 'Azure', 'Kubernetes', 'Terraform', 'Splunk', 'SIEM'])
  assert.deepEqual(required, ['Azure', 'Kubernetes', 'Terraform'])
  assert.deepEqual(preferred, ['AWS', 'Splunk', 'SIEM'])
})

test('ATS estimate: required counts double, format safety adds 15, base is scored the same way', () => {
  const { ats } = run(() => {}, withInventory(), { required_skills: null, job_description: POSTING })
  assert.deepEqual(ats.required, { covered: ['Azure', 'Terraform'], missing: ['Kubernetes'] })
  assert.deepEqual(ats.preferred, { covered: ['Splunk'], missing: ['AWS', 'SIEM'] })
  assert.equal(ats.score, Math.round((85 * (2 * 2 + 1)) / (2 * 3 + 3) + 15))
  assert.equal(ats.base_score, ats.score)
  assert.equal(run(() => {}, withInventory(), { required_skills: null, job_description: 'We use Azure.' }).ats.score, null)
})

test('word diff and number words', () => {
  assert.deepEqual(wordDiff('a b c', 'a x c'), [['=', 'a'], ['-', 'b'], ['+', 'x'], ['=', 'c']])
  assert.deepEqual([...numbersIn('forty-two hosts, fifteen groups and 3 sites, one by one')].sort(), ['15', '3', '42'])
})

test('the Edge Function copy is identical', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, file), 'utf8')
  assert.equal(read('../../supabase/functions/_shared/check.ts'), read('check.ts'))
})

test('coursework-only terms must be framed as coursework, and in-progress courses as current', () => {
  const base = withInventory({
    coursework: [
      { code: 'ITIS 5166', title: 'Backend App Development', term: 'Fall 2025', status: 'completed', topics: [], tools: ['MongoDB'] },
      { code: 'ITIS 6167', title: 'Network Security', term: 'Fall 2026', status: 'in_progress', topics: ['TCP/IP'], tools: [] },
    ],
  })
  assert.deepEqual(rules(run((p) => { p.answers.why_role = 'In my Backend App Development course I built a MongoDB service.' }, base)), [])
  assert.deepEqual(rules(run((p) => { p.answers.why_role = 'I have built MongoDB services.' }, base)), ['red:coursework_framing'])
  assert.deepEqual(rules(run((p) => { p.answers.why_role = 'My Network Security class covered TCP/IP.' }, base)), ['red:coursework_framing'])
  assert.deepEqual(rules(run((p) => { p.answers.why_role = 'I am currently taking a Network Security class that covers TCP/IP.' }, base)), [])
  // Terms the base already backs need no framing.
  assert.deepEqual(rules(run((p) => { p.answers.why_role = 'It matches my Azure work.' }, base)), [])
})

test('read-aloud pass: run-on sentences, stuffed keywords, duty openers and passive voice are yellow', () => {
  const long = Array.from({ length: 40 }, () => 'word').join(' ')
  assert.ok(rules(run((p) => { p.cover_letter.paragraphs[0] = `${long}.` })).includes('yellow:long_sentence'))
  assert.ok(!rules(run((p) => { p.cover_letter.paragraphs[0] = 'Short one. Another short one.' })).includes('yellow:long_sentence'))
  const stuffed = run((p) => { p.experience[0].bullets[0].text = 'Provisioned identity infrastructure as Terraform modules, reviewed in Terraform plans across dev, staging and production.' })
  assert.ok(rules(stuffed).includes('yellow:keyword_repeat'))
  // A paragraph may name a tool twice.
  assert.ok(!rules(run((p) => { p.cover_letter.paragraphs[1] = 'At Acme I wrote Terraform. The Terraform work covered three environments.' })).includes('yellow:keyword_repeat'))
  assert.ok(rules(run((p) => { p.experience[0].bullets[1].text = 'Responsible for an access review tool in PowerShell covering 3 identity platforms.' })).includes('yellow:duty_phrase'))
  assert.ok(rules(run((p) => { p.experience[0].bullets[1].text = 'An access review tool was built in PowerShell covering 3 identity platforms.' })).includes('yellow:passive'))
})

test('read-aloud pass: spell an acronym out once, and not two per line', () => {
  const stacked = run((p) => { p.answers.why_role = 'It pairs SIEM (Security Information and Event Management) with Identity and Access Management (IAM) work.' })
  assert.ok(rules(stacked).includes('yellow:stacked_expansions'))
  const twice = run((p) => {
    p.answers.why_role = 'It uses SIEM (Security Information and Event Management) tools.'
    p.answers.relevant_project = 'My honeypot fed a SIEM (Security Information and Event Management).'
  })
  assert.ok(twice.flags.some((flag) => flag.rule === 'repeated_expansion' && flag.message.startsWith('SIEM')))
  // "Splunk (SIEM)" names a product, it doesn't spell anything out.
  assert.ok(!rules(run((p) => { p.answers.why_role = 'I used Splunk (SIEM) and Azure (cloud).' })).some((rule) => rule.includes('expansion')))
})

test('one page: a resume the estimate puts past one page is red', () => {
  const base = withInventory()
  assert.ok(estimateResumeHeight(resolveResume(fixturePacket() as Packet, base)) < LAYOUT.pageHeight)
  // Six entries of three two-line bullets don't fit.
  const p2 = fixturePacket() as Packet & { experience: Array<{ id: string; bullets: Array<{ from: string; text: string }> }> }
  const b2 = withInventory()
  const job = b2.versions['Cloud Security'].experience[0]
  const text = 'Provisioned identity infrastructure as Terraform across dev, staging and production environments, keeping privileged resources separate.'
  for (let i = 2; i <= 6; i++) {
    b2.versions['Cloud Security'].experience.push({ ...job, id: `acme-${i}`, bullets: [{ id: `cloudsec:acme-${i}:1`, text }, { id: `cloudsec:acme-${i}:2`, text }, { id: `cloudsec:acme-${i}:3`, text }] })
    p2.experience.push({ id: `acme-${i}`, bullets: [1, 2, 3].map((n) => ({ from: `cloudsec:acme-${i}:${n}`, text })) })
  }
  const over = checkPacket(p2, b2, resolveResume(p2, b2), noJob)
  assert.ok(over.flags.some((flag) => flag.rule === 'over_one_page' && flag.severity === 'red'))
  assert.equal(over.status, 'blocked')
})

test('resume style: no first person, a strong first bullet, a tool named in at most two lines, no repeated project', () => {
  assert.ok(rules(run((p) => { p.summary.text = 'I build identity tooling with Azure and Terraform.' })).includes('yellow:first_person'))
  assert.ok(rules(run((p) => { p.summary.text = 'Engineer whose work is my focus.' })).includes('yellow:first_person'))
  // Cover letters and answers are first person by nature.
  assert.ok(!rules(run((p) => { p.answers.why_role = 'I like identity work.' })).includes('yellow:first_person'))
  assert.ok(rules(run((p) => { p.experience[0].bullets[0].text = 'Used Terraform to provision identity infrastructure across dev, staging and production environments.' })).includes('yellow:weak_lead'))
  const overuse = run((p) => { p.summary.text = 'Security-minded cloud engineer who builds identity tooling with Terraform.' })
  assert.ok(overuse.flags.some((flag) => flag.rule === 'tool_overuse' && flag.message.startsWith('"Terraform"')) === false, 'two lines is fine')
  const three = run((p) => {
    p.summary.text = 'Cloud engineer who writes Terraform.'
    p.projects[0].bullets[0].text = 'Analyzed 475+ security events across 44 attack sessions using Splunk, deployed with Terraform.'
  })
  assert.ok(three.flags.some((flag) => flag.rule === 'tool_overuse' && flag.message.startsWith('"Terraform"')))
  const base = withInventory()
  base.versions['Cloud Security'].projects[0].context = 'Acme'
  assert.ok(rules(run(() => {}, base)).includes('yellow:duplicate_project'))
})

