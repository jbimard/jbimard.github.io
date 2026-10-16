// The same resume and cover letter as render.ts, drawn as text-based PDFs: one column, the same headings and order,
// selectable text in standard fonts (no images, no outlines), so parsers that only take PDF read it the same way.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'
import { contactLine, letterDate } from './render.ts'
import type { BaseResumes, ResolvedEntry, ResolvedResume } from './packet.ts'
import { LAYOUT } from './check.ts'

const PAGE: [number, number] = [612, 792] // US Letter, points
const MARGIN = { top: 36, bottom: 36, side: 40 }
// Sizes and spacing shared with check.ts's one-page estimate.
const BODY = LAYOUT.body
const LEADING = LAYOUT.leading
// Usable height of one page, in points.
export const PAGE_HEIGHT = PAGE[1] - MARGIN.top - MARGIN.bottom

// Standard fonts only cover WinAnsi; anything else (arrows, emoji) would make pdf-lib throw.
const clean = (text: string) => text
  .replace(/[\u2010\u2011]/g, '-')
  .replace(/[\u2192\u27F6]/g, '->')
  .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC\u2122]/g, '?')

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont }
type Segment = { text: string; font: keyof Fonts }

class Writer {
  page: PDFPage
  y: number
  readonly width = PAGE[0] - 2 * MARGIN.side

  constructor(readonly pdf: PDFDocument, readonly fonts: Fonts) {
    this.page = pdf.addPage(PAGE)
    this.y = PAGE[1] - MARGIN.top
  }

  // Start a new page when the next line wouldn't fit.
  room(height: number) {
    if (this.y - height >= MARGIN.bottom) return
    this.page = this.pdf.addPage(PAGE)
    this.y = PAGE[1] - MARGIN.top
  }

  gap(points: number) {
    this.y -= points
  }

  // Wraps mixed-font text word by word. `indent` shifts every line; `hanging` is where wrapped lines start.
  paragraph(segments: Segment[], options: { size?: number; indent?: number; hanging?: number; align?: 'left' | 'center'; width?: number } = {}) {
    const size = options.size ?? BODY
    const width = options.width ?? this.width
    const indent = options.indent ?? 0
    const words = segments.flatMap(({ text, font }) => clean(text).split(/(\s+)/).filter(Boolean).map((word) => ({ word, font })))
    const lines: Array<typeof words> = [[]]
    let lineWidth = 0
    for (const item of words) {
      const start = lines.length === 1 ? indent : indent + (options.hanging ?? 0)
      const w = this.fonts[item.font].widthOfTextAtSize(item.word, size)
      if (/^\s+$/.test(item.word)) {
        if (lines.at(-1)!.length) {
          lines.at(-1)!.push(item)
          lineWidth += w
        }
        continue
      }
      if (lineWidth + w > width - start && lines.at(-1)!.length) {
        while (lines.at(-1)!.length && /^\s+$/.test(lines.at(-1)!.at(-1)!.word)) lines.at(-1)!.pop()
        lines.push([])
        lineWidth = 0
      }
      lines.at(-1)!.push(item)
      lineWidth += w
    }
    lines.forEach((line, i) => {
      this.room(size * LEADING)
      this.y -= size * LEADING
      const total = line.reduce((sum, { word, font }) => sum + this.fonts[font].widthOfTextAtSize(word, size), 0)
      let x = MARGIN.side + (options.align === 'center' ? (width - total) / 2 : i === 0 ? indent : indent + (options.hanging ?? 0))
      for (const { word, font } of line) {
        this.page.drawText(word, { x, y: this.y, size, font: this.fonts[font], color: rgb(0, 0, 0) })
        x += this.fonts[font].widthOfTextAtSize(word, size)
      }
    })
  }

  // A left part plus right-aligned text on the same line (dates), wrapping the left part if needed.
  lineWithRight(left: Segment, right: string | null) {
    if (!right) return this.paragraph([left])
    const rightText = clean(right)
    const rightWidth = this.fonts.regular.widthOfTextAtSize(rightText, BODY)
    this.room(BODY * LEADING)
    const page = this.page
    const firstLine = this.y - BODY * LEADING
    // The left part wraps short of the dates, which sit on its first line.
    this.paragraph([left], { width: this.width - rightWidth - 12 })
    page.drawText(rightText, { x: MARGIN.side + this.width - rightWidth, y: firstLine, size: BODY, font: this.fonts.regular })
  }

  heading(text: string) {
    this.room(12 * LEADING + 8 + BODY * LEADING)
    this.gap(8)
    this.paragraph([{ text, font: 'bold' }], { size: 12 })
    this.gap(2)
    this.page.drawLine({ start: { x: MARGIN.side, y: this.y }, end: { x: MARGIN.side + this.width, y: this.y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) })
    this.gap(2)
  }

  bullet(text: string) {
    this.paragraph([{ text: '•  ', font: 'regular' }, { text, font: 'regular' }], { indent: 14, hanging: 9 })
  }
}

const open = async (title: string, author: string) => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(clean(title))
  pdf.setAuthor(clean(author))
  pdf.setCreator('jbimard job pipeline')
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  }
  return new Writer(pdf, fonts)
}

const entry = (w: Writer, item: ResolvedEntry) => {
  w.gap(3)
  w.lineWithRight({ text: item.heading, font: 'bold' }, item.subheading ? null : item.right)
  if (item.subheading) w.lineWithRight({ text: item.subheading, font: 'italic' }, item.right)
  for (const text of item.bullets) w.bullet(text)
}

const drawResume = async (resume: ResolvedResume) => {
  const w = await open(`${resume.contact.name} Resume`, resume.contact.name)
  w.paragraph([{ text: resume.contact.name, font: 'bold' }], { size: 16, align: 'center' })
  w.paragraph([{ text: contactLine(resume.contact), font: 'regular' }], { align: 'center' })
  w.heading('Summary')
  w.paragraph([{ text: resume.summary, font: 'regular' }])
  w.heading('Education')
  for (const school of resume.education) {
    w.paragraph([{ text: `${school.school}${school.location ? `, ${school.location}` : ''}`, font: 'bold' }])
    for (const degree of school.degrees) w.lineWithRight({ text: degree.degree, font: 'regular' }, degree.date)
  }
  if (resume.coursework.length) w.paragraph([{ text: 'Relevant Coursework: ', font: 'bold' }, { text: resume.coursework.join(', '), font: 'regular' }])
  w.heading('Experience')
  for (const item of resume.experience) entry(w, item)
  if (resume.projects.length) {
    w.heading('Projects')
    for (const item of resume.projects) entry(w, item)
  }
  w.heading('Skills')
  for (const group of resume.skills) w.paragraph([{ text: `${group.label}: `, font: 'bold' }, { text: group.items.join(', '), font: 'regular' }])
  if (resume.certifications.length) {
    w.heading('Certifications')
    for (const cert of resume.certifications) w.bullet(cert)
  }
  return w
}

export const renderResumePdf = async (resume: ResolvedResume): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await (await drawResume(resume)).pdf.save())

// How much the resume fills: page count, and total height used in points (a full first page is PAGE_HEIGHT).
// job-prep and packet-edit refuse anything over one page.
export const measureResumePdf = async (resume: ResolvedResume) => {
  const w = await drawResume(resume)
  const pages = w.pdf.getPageCount()
  return { pages, used: (pages - 1) * PAGE_HEIGHT + (PAGE[1] - MARGIN.top - w.y) }
}

export const renderCoverLetterPdf = async (
  contact: BaseResumes['contact'],
  job: { company: string; role_title: string },
  paragraphs: string[],
  date: Date,
): Promise<Uint8Array<ArrayBuffer>> => {
  const w = await open(`${contact.name} Cover Letter`, contact.name)
  const block = (segments: Segment[], after = 10) => {
    w.paragraph(segments)
    w.gap(after)
  }
  w.paragraph([{ text: contact.name, font: 'bold' }], { size: 14 })
  block([{ text: contactLine(contact), font: 'regular' }], 16)
  block([{ text: letterDate(date), font: 'regular' }])
  block([{ text: `Re: ${job.role_title}`, font: 'bold' }])
  block([{ text: `Dear ${job.company} Hiring Team,`, font: 'regular' }])
  for (const paragraph of paragraphs) block([{ text: paragraph.trim(), font: 'regular' }])
  w.paragraph([{ text: 'Sincerely,', font: 'regular' }])
  w.paragraph([{ text: contact.name, font: 'regular' }])
  return new Uint8Array(await w.pdf.save())
}
