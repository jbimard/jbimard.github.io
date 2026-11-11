// Turns what the form inspector copied (page text he pasted) into an ApplicationForm. The snapshot comes from an employer's
// page, so it is data: parsed strictly, every string cut to length and flattened to one line, nothing from it is ever run.
import { isEligibility, type ApplicationForm, type FormQuestion } from './applicationForm.ts'

const KINDS = new Set<FormQuestion['kind']>(['text', 'long_text', 'choice', 'multi_choice', 'file', 'other'])
const MAX_FIELDS = 150
const MAX_OPTIONS = 40

// One short plain line: control characters and angle brackets become spaces, runs of whitespace collapse.
const line = (value: unknown, max: number) => (typeof value === 'string'
  ? [...value].map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '<' || char === '>' ? ' ' : char)).join('').replace(/\s+/g, ' ').trim().slice(0, max)
  : '')

// Fields every application has; they are counted, not listed, like Greenhouse's built-ins.
const STANDARD = /^(?:(?:legal |first |last |full |preferred |given |family )?name|first name|last name|email(?: address)?|phone(?: number)?|mobile(?: number)?|resume(?:\/cv)?|cv|cover letter|address|city|state|zip(?: code)?|postal code|country)$/i

export type ImportedForm = { form: ApplicationForm; page: string; title: string }

export const importFormSnapshot = (input: string): ImportedForm => {
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch {
    throw new Error('That is not what the form reader copies. Run it on the application page and paste again.')
  }
  const root = data as { v?: unknown; page?: unknown; title?: unknown; fields?: unknown }
  if (!root || typeof root !== 'object' || root.v !== 1 || !Array.isArray(root.fields)) {
    throw new Error('That is not a form snapshot (wrong version or no fields).')
  }
  const questions: FormQuestion[] = []
  let standardCount = 0
  for (const entry of root.fields.slice(0, MAX_FIELDS) as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const label = line(entry.label, 200)
    if (!label) continue
    if (STANDARD.test(label)) {
      standardCount++
      continue
    }
    const options = Array.isArray(entry.options) ? entry.options.slice(0, MAX_OPTIONS).map((option) => line(option, 120)).filter(Boolean) : []
    const maxlength = typeof entry.maxlength === 'number' && Number.isInteger(entry.maxlength) && entry.maxlength > 0 && entry.maxlength < 1_000_000 ? entry.maxlength : undefined
    const accept = line(entry.accept, 120) || undefined
    const optionCount = typeof entry.optionCount === 'number' && Number.isInteger(entry.optionCount) && entry.optionCount > options.length && entry.optionCount < 1_000_000 ? entry.optionCount : undefined
    questions.push({
      label,
      required: entry.required === true,
      kind: KINDS.has(entry.type as FormQuestion['kind']) ? entry.type as FormQuestion['kind'] : 'other',
      options,
      eligibility: isEligibility(label, options),
      ...(maxlength ? { maxlength } : {}),
      ...(accept ? { accept } : {}),
      ...(optionCount ? { optionCount } : {}),
    })
  }
  return { form: { questions, standardCount, deadline: null }, page: line(root.page, 300), title: line(root.title, 200) }
}
