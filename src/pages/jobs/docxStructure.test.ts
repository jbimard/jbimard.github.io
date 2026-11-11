import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { checkDocxStructure } from './docxStructure.ts'

const body = (inner: string, sect = '<w:sectPr><w:cols w:space="720"/></w:sectPr>') => `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${inner}${sect}</w:body></w:document>`
const docx = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])))
const byId = (bytes: Uint8Array) => Object.fromEntries(checkDocxStructure(bytes).map((finding) => [finding.id, finding]))

test('a plain single-column document passes every structure check', () => {
  const results = checkDocxStructure(docx({ 'word/document.xml': body('<w:p><w:r><w:t>Hello</w:t></w:r></w:p>'), 'word/footnotes.xml': '<x/>' }))
  assert.deepEqual(results.map((r) => r.status), ['pass', 'pass', 'pass', 'pass', 'pass'])
})

test('text in a header or footer fails; an empty one is fine', () => {
  const withText = byId(docx({ 'word/document.xml': body(''), 'word/header1.xml': '<w:hdr><w:p><w:r><w:t xml:space="preserve">joseph@example.com | 919-555-0142</w:t></w:r></w:p></w:hdr>' }))
  assert.equal(withText.docx_margins.status, 'fail')
  assert.match(withText.docx_margins.detail, /header1\.xml.*joseph@example\.com/)
  const empty = byId(docx({ 'word/document.xml': body(''), 'word/footer1.xml': '<w:ftr><w:p/></w:ftr>' }))
  assert.equal(empty.docx_margins.status, 'pass')
})

test('tables warn, text boxes fail, images warn, extra columns fail', () => {
  assert.equal(byId(docx({ 'word/document.xml': body('<w:tbl><w:tr/></w:tbl>') })).docx_tables.status, 'warn')
  assert.equal(byId(docx({ 'word/document.xml': body('<w:p><w:txbxContent><w:p/></w:txbxContent></w:p>') })).docx_textboxes.status, 'fail')
  assert.equal(byId(docx({ 'word/document.xml': body(''), 'word/media/image1.png': 'x' })).docx_images.status, 'warn')
  assert.equal(byId(docx({ 'word/document.xml': body('<w:p><w:drawing/></w:p>') })).docx_images.status, 'warn')
  assert.equal(byId(docx({ 'word/document.xml': body('', '<w:sectPr><w:cols w:num="2" w:space="720"/></w:sectPr>') })).docx_columns.status, 'fail')
  assert.equal(byId(docx({ 'word/document.xml': body('', '<w:sectPr><w:cols w:num="1"/></w:sectPr>') })).docx_columns.status, 'pass')
})

test('something that is not a Word package fails alone', () => {
  assert.deepEqual(checkDocxStructure(strToU8('not a zip')).map((r) => [r.id, r.status]), [['docx_zip', 'fail']])
  assert.deepEqual(checkDocxStructure(docx({ 'other.txt': 'x' })).map((r) => [r.id, r.status]), [['docx_zip', 'fail']])
})
