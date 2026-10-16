// deno test supabase/functions/_shared/render_pdf_test.ts — not imported by any function, so it is never deployed.
// Writes the PDFs to $PDF_OUT (when set) so the text layer can be checked with pdftotext or a parser like OpenResume.
import { PDFDocument } from 'npm:pdf-lib@1.17.1'
import { renderCoverLetterPdf, renderResumePdf } from './render_pdf.ts'
import type { ResolvedResume } from './packet.ts'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const resume: ResolvedResume = {
  contact: { name: 'Test Person', location: 'Charlotte, NC', email: 'test@example.com', phone: '000-000-0000', links: ['example.com'] },
  summary: 'Cloud-focused engineer → security.',
  education: [{ school: 'Example University', location: 'Charlotte, NC', degrees: [{ degree: 'MS in Cybersecurity', date: 'May 2027' }] }],
  coursework: ['Network Security (in progress)'],
  certifications: ['Example Job Simulation (Forage), Jan 2025'],
  experience: [{
    heading: 'Acme, Charlotte, NC',
    subheading: 'Security Intern',
    right: 'May 2026 – Aug 2026',
    bullets: Array.from({ length: 30 }, (_, i) => `Bullet ${i + 1}: built an access review tool in PowerShell covering 3 identity platforms, with a long enough line to wrap onto a second line.`),
    sources: [],
  }],
  projects: [],
  skills: [{ label: 'Tools', items: ['Azure', 'Terraform'] }],
}

Deno.test('resume and cover letter PDFs render, wrap onto a second page, and survive characters outside WinAnsi', async () => {
  const pdf = await renderResumePdf(resume)
  const letter = await renderCoverLetterPdf(resume.contact, { company: 'Acme', role_title: 'Cloud Engineer' }, ['One.', 'Two.', 'Three.'], new Date('2026-10-20T14:00:00Z'))
  const head = new TextDecoder().decode(pdf.slice(0, 5))
  assert(head === '%PDF-', 'a PDF file')
  assert((await PDFDocument.load(pdf)).getPageCount() >= 2, 'long resume runs onto a second page')
  assert((await PDFDocument.load(letter)).getPageCount() === 1, 'short letter is one page')
  const out = Deno.env.get('PDF_OUT')
  if (out) {
    await Deno.writeFile(`${out}/resume.pdf`, pdf)
    await Deno.writeFile(`${out}/letter.pdf`, letter)
  }
})
