// Parse check: reads the stored resume back the way a resume parser would (PDF.js for the PDF, Mammoth for the DOCX)
// and compares what comes out with what the packet says should be there. It tests our own files for clean extraction.
// It is not an employer's parser: the check says whether text survives and stays in order, not how anyone scores it.
import { FOUND, GARBLED, roundTrip } from './roundTrip.ts'

export type ExpectedEntry = { heading: string; right: string | null; bullets: string[] }
export type Expected = { summary: string | null; entries: ExpectedEntry[] }
export type Finding = { id: string; status: 'pass' | 'warn' | 'fail'; label: string; detail: string }

// One comparison form for both sides: ligatures and width forms folded, quotes and dashes flattened, all whitespace gone,
// so a line wrapped differently or a hyphen split across lines still matches.
export const squeeze = (text: string) => text
  .normalize('NFKC')
  .replace(/[‘’‛]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[‐‑‒–—−]/g, '-')
  .replace(/­/g, '')
  .replace(/\s+/g, '')
  .toLowerCase()

const HEADINGS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Education', pattern: /^education$/i },
  { name: 'Experience', pattern: /^(?:work |professional )?experience$/i },
  { name: 'Projects', pattern: /^(?:selected |technical )?projects$/i },
  { name: 'Skills', pattern: /^(?:technical )?skills$/i },
]

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/

const listed = (items: string[], max = 3) => `${items.slice(0, max).map((item) => `“${item.length > 60 ? `${item.slice(0, 57)}…` : item}”`).join(', ')}${items.length > max ? ` and ${items.length - max} more` : ''}`

export const checkExtraction = (extracted: string, expected: Expected, pages: string[] = []): Finding[] => {
  const findings: Finding[] = []
  const add = (id: string, status: Finding['status'], label: string, detail: string) => findings.push({ id, status, label, detail })
  const lines = extracted.split('\n').map((line) => line.trim()).filter(Boolean)

  if (squeeze(extracted).length < 200) {
    add('text', 'fail', 'Text comes out', 'Almost no text was extracted. A parser would see an empty resume (a scanned image, or text drawn as shapes).')
    return findings
  }
  add('text', 'pass', 'Text comes out', `${lines.length} lines extracted.`)

  // Contact details sit in the body, not a header, so a parser that skips headers still sees them.
  const head = lines.slice(0, 8).join('\n')
  add('contact', EMAIL.test(head) && PHONE.test(head) ? 'pass' : 'fail', 'Email and phone in the first lines',
    EMAIL.test(head) && PHONE.test(head) ? 'Both found at the top, where parsers look.' : `Missing from the first lines: ${[EMAIL.test(head) ? '' : 'email', PHONE.test(head) ? '' : 'phone'].filter(Boolean).join(' and ')}.`)

  // Standard section headings, as their own lines, in the usual order.
  const found = HEADINGS.map(({ name, pattern }) => ({ name, at: lines.findIndex((line) => pattern.test(line.replace(/[:：]$/, ''))) }))
  const missing = found.filter((heading) => heading.at < 0).map((heading) => heading.name)
  const present = found.filter((heading) => heading.at >= 0)
  const inOrder = present.every((heading, i) => i === 0 || heading.at > present[i - 1].at)
  add('headings', missing.length === 0 ? 'pass' : present.length >= 2 ? 'warn' : 'fail', 'Standard section headings',
    missing.length === 0 ? 'Education, Experience, Projects and Skills each found on their own line.' : `Not found as standard headings: ${missing.join(', ')}. Parsers file text under the headings they recognise.`)
  if (present.length >= 2) add('order', inOrder ? 'pass' : 'warn', 'Headings in a normal order', inOrder ? 'Sections come out top to bottom as written.' : 'Sections come out in a different order than the file shows. A two-column layout does this.')

  const flat = squeeze(extracted)
  const wanted: Array<{ text: string; kind: 'bullet' | 'summary' | 'date' | 'heading' }> = []
  if (expected.summary) wanted.push({ text: expected.summary, kind: 'summary' })
  for (const entry of expected.entries) {
    wanted.push({ text: entry.heading, kind: 'heading' })
    if (entry.right) wanted.push({ text: entry.right, kind: 'date' })
    for (const bullet of entry.bullets) wanted.push({ text: bullet, kind: 'bullet' })
  }

  const lost = wanted.filter((item) => item.text.trim() && !flat.includes(squeeze(item.text)))
  const total = wanted.filter((item) => item.text.trim()).length
  if (total > 0) {
    const ratio = (total - lost.length) / total
    add('content', lost.length === 0 ? 'pass' : ratio >= 0.9 ? 'warn' : 'fail', 'Every line comes out intact',
      lost.length === 0 ? `All ${total} summary, heading, date and bullet lines found.` : `${total - lost.length} of ${total} found. Missing or altered: ${listed(lost.map((item) => item.text))}.`)
  }
  const dates = wanted.filter((item) => item.kind === 'date' && item.text.trim())
  const lostDates = dates.filter((item) => !flat.includes(squeeze(item.text)))
  if (dates.length > 0) add('dates', lostDates.length === 0 ? 'pass' : 'fail', 'Dates come out readable', lostDates.length === 0 ? `All ${dates.length} date ranges extracted as written.` : `Not extracted as written: ${listed(lostDates.map((item) => item.text))}. A parser could miss the time at that job.`)

  // Reading order: the bullets, found one after another, must come out in file order (columns or text boxes scramble it).
  let cursor = 0
  let outOfOrder = 0
  for (const item of wanted.filter((entry) => entry.kind === 'bullet')) {
    const at = flat.indexOf(squeeze(item.text), cursor)
    if (at < 0) {
      if (flat.includes(squeeze(item.text))) outOfOrder++
    } else {
      cursor = at + 1
    }
  }
  if (wanted.some((item) => item.kind === 'bullet')) add('reading_order', outOfOrder === 0 ? 'pass' : 'fail', 'Reading order', outOfOrder === 0 ? 'Bullets come out in the order the file shows them.' : `${outOfOrder} bullet${outOfOrder === 1 ? '' : 's'} come out in a different order than the file. Layout (columns, text boxes) is scrambling the read.`)

  // Characters that mean a font or encoding problem: replacement characters, private-use glyphs and PDF.js "(cid:12)" codes.
  const junk = (extracted.match(/\(cid:\d+\)|[\uFFFD\uE000-\uF8FF]/g) ?? []).length
  const spaced = lines.filter((line) => /^(?:\S ){6,}\S$/.test(line)).length
  add('encoding', junk === 0 && spaced === 0 ? 'pass' : 'fail', 'Clean characters',
    junk === 0 && spaced === 0 ? 'No broken glyphs or letter-spaced words.' : `${junk} broken glyph${junk === 1 ? '' : 's'} and ${spaced} letter-spaced line${spaced === 1 ? '' : 's'}. The font or encoding is not reading back as text.`)

  // A page with almost no text next to a full one: content drawn as an image, or a font that does not extract.
  const sparse = pages.map((page, i) => ({ page: i + 1, chars: squeeze(page).length })).filter((entry) => entry.chars < 200)
  if (pages.length > 1 && sparse.length > 0) add('sparse_pages', 'warn', 'Text on every page', `Page ${sparse.map((entry) => entry.page).join(', ')} has very little text (${sparse[0].chars} characters).`)

  const trip = roundTrip(extracted, expected)
  const partial = trip.fields.filter((field) => field.status === 'garbled')
  const percent = (value: number) => `${Math.round(value * 100)}%`
  add('round_trip', trip.recall >= FOUND && trip.orderFidelity >= FOUND && partial.length === 0 ? 'pass' : trip.recall >= GARBLED ? 'warn' : 'fail', 'Round trip',
    `Content recall ${percent(trip.recall)}, order fidelity ${percent(trip.orderFidelity)}.${partial.length > 0 ? ` Partly extracted: ${listed(partial.map((field) => field.text))}.` : ''}`)
  return findings
}

// The worst result for a quick badge.
export const overall = (findings: Finding[]): Finding['status'] => (
  findings.some((finding) => finding.status === 'fail') ? 'fail' : findings.some((finding) => finding.status === 'warn') ? 'warn' : 'pass'
)
