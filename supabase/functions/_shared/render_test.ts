// deno test supabase/functions/_shared/render_test.ts — not imported by any function, so it is never deployed.
import JSZip from 'npm:jszip@3.10.1'
import { fileStem, renderCoverLetter, renderResume } from './render.ts'
import type { ResolvedResume } from './packet.ts'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const resume: ResolvedResume = {
  contact: { name: 'Test Person', location: 'Charlotte, NC', email: 'test@example.com', phone: '000-000-0000', links: ['example.com'] },
  summary: 'Cloud-focused engineer.',
  education: [{ school: 'Example University', location: 'Charlotte, NC', degrees: [{ degree: 'MS in Cybersecurity', date: 'May 2027' }] }],
  coursework: ['Network Security (in progress)', 'Database Design'],
  certifications: [],
  experience: [{ heading: 'Acme, Charlotte, NC', subheading: 'Security Intern', right: 'May 2026 – Aug 2026', bullets: ['Built a tool & shipped it <safely>.'], sources: [] }],
  projects: [{ heading: 'SSH Honeypot', subheading: null, right: 'GitHub', bullets: ['Analyzed 475+ events.'], sources: [] }],
  skills: [{ label: 'Tools', items: ['Azure', 'Terraform'] }],
}

const unzip = async (bytes: Uint8Array) => {
  const zip = await JSZip.loadAsync(bytes)
  return { names: Object.keys(zip.files), document: await zip.file('word/document.xml')!.async('string') }
}

Deno.test('resume: single column, standard headings, contact in the body, no header or footer', async () => {
  const { names, document } = await unzip(await renderResume(resume))
  for (const heading of ['Summary', 'Education', 'Experience', 'Projects', 'Skills']) assert(document.includes(`>${heading}<`), `missing heading ${heading}`)
  assert(document.includes('test@example.com'), 'contact line should be in the document body')
  assert(!names.some((name) => /word\/(header|footer)\d*\.xml/.test(name)), 'no header or footer parts')
  assert(!/<w:cols [^>]*w:num="[2-9]"/.test(document), 'single column')
  assert(!document.includes('<w:tbl>') && !document.includes('<w:drawing>') && !document.includes('<w:txbxContent>'), 'no tables, images or text boxes')
  assert(document.includes('Built a tool &amp; shipped it &lt;safely&gt;.'), 'text is escaped')
  assert(document.includes('May 2026 – Aug 2026'), 'dates come through')
  assert(document.includes('Relevant Coursework: ') && document.includes('Network Security (in progress), Database Design'), 'coursework line')
  const { document: without } = await unzip(await renderResume({ ...resume, coursework: [] }))
  assert(!without.includes('Relevant Coursework'), 'no coursework line when none is picked')
})

Deno.test('cover letter: greeting, paragraphs and sign-off', async () => {
  const { document } = await unzip(await renderCoverLetter(resume.contact, { company: 'Acme', role_title: 'Cloud Engineer' }, ['One.', 'Two.', 'Three.'], new Date('2026-10-20T14:00:00Z')))
  for (const text of ['Dear Acme Hiring Team,', 'Re: Cloud Engineer', 'October 20, 2026', 'Two.', 'Sincerely,']) assert(document.includes(text), `missing ${text}`)
})

Deno.test('relocation sits next to the location on the contact line', async () => {
  const { document } = await unzip(await renderResume({ ...resume, contact: { ...resume.contact, relocation: 'Open to relocation' } }))
  assert(document.includes('Charlotte, NC | Open to relocation | test@example.com'), 'relocation after location')
})

Deno.test('file names', () => {
  assert(fileStem('Wells Fargo & Co.') === 'Wells-Fargo-Co', fileStem('Wells Fargo & Co.'))
  assert(fileStem('***') === 'Company', 'empty falls back')
})

Deno.test('resume: certifications get their own section, and none means no heading', async () => {
  const { document } = await unzip(await renderResume({ ...resume, certifications: ['Example Job Simulation (Forage), Jan 2025'] }))
  assert(document.includes('>Certifications<') && document.includes('Example Job Simulation (Forage), Jan 2025'), 'certifications section')
  const { document: without } = await unzip(await renderResume(resume))
  assert(!without.includes('>Certifications<'), 'no section without certifications')
})
