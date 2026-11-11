// Structure checks on the .docx package itself, for what a text read (Mammoth) cannot see: headers and footers, tables,
// text boxes, images and columns. Parsers that drop or scramble these lose the content in them. The checks are modelled on
// the deterministic ATS-parse checks in Resume Matcher (Apache-2.0, github.com/srbhr/Resume-Matcher), written afresh here.
import { strFromU8, unzipSync } from 'fflate'
import type { Finding } from './parseCheck.ts'

const textOf = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join('').trim()

export const checkDocxStructure = (docx: Uint8Array): Finding[] => {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(docx, { filter: (file) => /^word\/(?:document|header\d*|footer\d*)\.xml$|^word\/media\//.test(file.name) })
  } catch {
    return [{ id: 'docx_zip', status: 'fail', label: 'Readable Word file', detail: 'The .docx could not be opened as a Word package.' }]
  }
  const findings: Finding[] = []
  const add = (id: string, status: Finding['status'], label: string, detail: string) => findings.push({ id, status, label, detail })
  const document = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : ''
  if (!document) return [{ id: 'docx_zip', status: 'fail', label: 'Readable Word file', detail: 'The package has no word/document.xml.' }]

  // Headers and footers: parsers often skip them. Content there is a risk; an empty one is harmless.
  const margins = Object.entries(files).filter(([name]) => /^word\/(?:header|footer)\d*\.xml$/.test(name))
    .map(([name, bytes]) => ({ name: name.replace('word/', ''), text: textOf(strFromU8(bytes)) })).filter((part) => part.text)
  add('docx_margins', margins.length === 0 ? 'pass' : 'fail', 'Nothing in headers or footers',
    margins.length === 0 ? 'No text in any header or footer, so nothing sits where parsers skip.' : `Text in ${margins.map((part) => part.name).join(', ')}: “${margins[0].text.slice(0, 60)}”. Parsers that skip headers and footers lose it.`)

  const tables = (document.match(/<w:tbl>/g) ?? []).length
  add('docx_tables', tables === 0 ? 'pass' : 'warn', 'No tables', tables === 0 ? 'The resume uses no tables.' : `${tables} table${tables === 1 ? '' : 's'}. Parsers read tables cell by cell and can mix up the order.`)

  const boxes = (document.match(/<w:txbxContent>/g) ?? []).length
  add('docx_textboxes', boxes === 0 ? 'pass' : 'fail', 'No text boxes', boxes === 0 ? 'No text boxes.' : `${boxes} text box${boxes === 1 ? '' : 'es'}. Their text is often not read at all.`)

  const images = Object.keys(files).filter((name) => name.startsWith('word/media/')).length + (document.match(/<w:(?:pict|drawing)[\s>/]/g) ?? []).length
  add('docx_images', images === 0 ? 'pass' : 'warn', 'No images or drawings', images === 0 ? 'No images, shapes or drawings.' : 'The file holds an image or drawing, which a parser cannot read as text.')

  const columns = [...document.matchAll(/<w:cols\b[^>]*\bw:num="(\d+)"/g)].some((match) => Number(match[1]) > 1)
  add('docx_columns', columns ? 'fail' : 'pass', 'Single column', columns ? 'A section is set to more than one column, which scrambles reading order.' : 'One column throughout.')
  return findings
}
