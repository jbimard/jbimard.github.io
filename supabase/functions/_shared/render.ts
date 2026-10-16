// Renders the tailored resume and cover letter as ATS-safe .docx files from a fixed template:
// one column, standard section headings, no tables, text boxes or images, and the contact details in the body
// (not in a header or footer, which many ATS parsers skip). Content comes from packet.ts's resolveResume.
// render_pdf.ts draws the same layout as a text-based PDF.
import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from 'npm:docx@9.11.0'
import type { BaseResumes, ResolvedEntry, ResolvedResume } from './packet.ts'

// Arial: on every machine (so the browser preview matches Word) and the same metrics as the PDF's Helvetica.
const FONT = 'Arial'
const BODY = 21 // half-points: 10.5 pt
const PAGE = { margin: { top: 720, bottom: 720, left: 806, right: 806 } } // twips: 0.5 in / 0.56 in
const RIGHT_TAB = 10640 // right edge of the text area, for dates

const run = (text: string, options: { bold?: boolean; italics?: boolean; size?: number } = {}) => (
  new TextRun({ text, font: FONT, size: options.size ?? BODY, bold: options.bold, italics: options.italics })
)

const heading = (text: string) => new Paragraph({
  children: [run(text, { bold: true, size: 24 })],
  spacing: { before: 160, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
})

const lineWithRight = (left: TextRun[], right: string | null) => new Paragraph({
  children: right ? [...left, run(`\t${right}`)] : left,
  tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
  spacing: { before: 40, after: 0 },
})

const bullet = (text: string) => new Paragraph({ children: [run(text)], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 20 } })

export const contactLine = (contact: BaseResumes['contact']) => (
  [contact.location, contact.relocation, contact.email, contact.phone, ...contact.links].filter(Boolean).join(' | ')
)

const entry = (item: ResolvedEntry) => [
  lineWithRight([run(item.heading, { bold: true })], item.subheading ? null : item.right),
  ...(item.subheading ? [lineWithRight([run(item.subheading, { italics: true })], item.right)] : []),
  ...item.bullets.map(bullet),
]

const document = (children: Paragraph[]) => new Document({
  creator: 'jbimard job pipeline',
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }],
    }],
  },
  sections: [{ properties: { page: PAGE }, children }],
})

export const renderResume = async (resume: ResolvedResume): Promise<Uint8Array<ArrayBuffer>> => {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(resume.contact.name, { bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(contactLine(resume.contact))] }),
    heading('Summary'),
    new Paragraph({ children: [run(resume.summary)] }),
    heading('Education'),
    ...resume.education.flatMap((school) => [
      lineWithRight([run(`${school.school}${school.location ? `, ${school.location}` : ''}`, { bold: true })], null),
      ...school.degrees.map((degree) => lineWithRight([run(degree.degree)], degree.date)),
    ]),
    ...(resume.coursework.length ? [new Paragraph({ children: [run('Relevant Coursework: ', { bold: true }), run(resume.coursework.join(', '))] })] : []),
    heading('Experience'),
    ...resume.experience.flatMap(entry),
    ...(resume.projects.length ? [heading('Projects'), ...resume.projects.flatMap(entry)] : []),
    heading('Skills'),
    ...resume.skills.map((group) => new Paragraph({ children: [run(`${group.label}: `, { bold: true }), run(group.items.join(', '))] })),
    ...(resume.certifications.length ? [heading('Certifications'), ...resume.certifications.map(bullet)] : []),
  ]
  return new Uint8Array(await Packer.toBuffer(document(children)))
}

export const letterDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })

export const renderCoverLetter = async (
  contact: BaseResumes['contact'],
  job: { company: string; role_title: string },
  paragraphs: string[],
  date: Date,
): Promise<Uint8Array<ArrayBuffer>> => {
  const spaced = (children: TextRun[], after = 200) => new Paragraph({ children, spacing: { after } })
  const children = [
    new Paragraph({ children: [run(contact.name, { bold: true, size: 28 })] }),
    spaced([run(contactLine(contact))], 320),
    spaced([run(letterDate(date))]),
    spaced([run(`Re: ${job.role_title}`, { bold: true })]),
    spaced([run(`Dear ${job.company} Hiring Team,`)]),
    ...paragraphs.map((paragraph) => spaced([run(paragraph.trim())])),
    new Paragraph({ children: [run('Sincerely,')] }),
    new Paragraph({ children: [run(contact.name)] }),
  ]
  return new Uint8Array(await Packer.toBuffer(document(children)))
}

// "Wells Fargo & Co." -> "Wells-Fargo-Co"; files are named the same way for every job.
export const fileStem = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Company'
