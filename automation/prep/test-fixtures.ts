// Test fixtures shared by packet.test.ts and check.test.ts. A made-up person; the real base is private and never in the repo.
import type { BaseResumes, BaseVersion } from './packet.ts'

export const version = (key: string, dates: string): BaseVersion => ({
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

export const base = (): BaseResumes => ({
  contact: { name: 'Test Person', location: 'Charlotte, NC', email: 'test@example.com', phone: '000-000-0000', links: ['example.com'] },
  workAuthorization: [{ question: 'Authorized to work in the US?', answer: 'Yes.' }],
  versions: { 'Cloud': version('cloud', 'May 2026 – Aug 2026'), 'Security': version('sec', 'May 2026 – Present'), 'Cloud Security': version('cloudsec', 'May 2026 – Aug 2026') },
})

export const packet = () => ({
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
