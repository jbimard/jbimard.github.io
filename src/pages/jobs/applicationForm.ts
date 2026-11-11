// The employer's real application form, read before applying. Greenhouse's public job endpoint returns every question
// with its required flag and choices when asked with `?questions=true` (browser requests are allowed), so nothing is
// stored and no account or token is needed. Other systems keep their form schemas behind employer credentials.

export type FormQuestion = {
  label: string
  required: boolean
  // What the field takes: text, long text, choice, multi-choice, file, ...
  kind: 'text' | 'long_text' | 'choice' | 'multi_choice' | 'file' | 'other'
  options: string[]
  // Work authorization, sponsorship, citizenship, clearance or legal-eligibility wording: answer from the packet's fixed answers only.
  eligibility: boolean
}

export type ApplicationForm = {
  questions: FormQuestion[]
  // Built-in fields every Greenhouse form has (name, email, phone, resume, ...), left out of `questions`.
  standardCount: number
  deadline: string | null
}

type RawField = { name?: string; type?: string; values?: Array<{ label?: string }> }
type RawQuestion = { label?: string; required?: boolean; fields?: RawField[] }
type RawJob = { questions?: RawQuestion[]; demographic_questions?: { questions?: RawQuestion[] } | null; application_deadline?: string | null }

// Only the questions the packet's fixed answers cover or that can screen someone out.
const ELIGIBILITY = /sponsor|visa|work authori[sz]|authori[sz]ed to work|legally (?:authori[sz]ed|eligible|permitted)|right to work|immigration|citizen|permanent resident|green card|security clearance|\bclearance\b|export control|\bitar\b|\bead\b|\bopt\b|h-?1b/i

const STANDARD = new Set(['first_name', 'last_name', 'preferred_name', 'email', 'phone', 'resume', 'resume_text', 'cover_letter', 'cover_letter_text', 'location'])

export const greenhouseRef = (link: string | null): { board: string; id: string } | null => {
  if (!link) return null
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  if (!/(^|\.)greenhouse\.io$/.test(url.hostname)) return null
  const match = /^\/(?:embed\/job_app\/?)?([^/]+)\/jobs\/(\d+)/.exec(url.pathname)
  if (match) return { board: match[1], id: match[2] }
  const board = url.searchParams.get('for')
  const id = url.searchParams.get('token') ?? url.searchParams.get('gh_jid')
  return board && id && /^\d+$/.test(id) ? { board, id } : null
}

const kindOf = (field: RawField): FormQuestion['kind'] => {
  switch (field.type) {
    case 'input_text': return 'text'
    case 'textarea': return 'long_text'
    case 'input_file': return 'file'
    case 'multi_value_single_select': return 'choice'
    case 'multi_value_multi_select': return 'multi_choice'
    default: return 'other'
  }
}

export const summarizeForm = (raw: RawJob): ApplicationForm => {
  const questions: FormQuestion[] = []
  let standardCount = 0
  for (const question of raw.questions ?? []) {
    const fields = question.fields ?? []
    if (fields.length > 0 && fields.every((field) => STANDARD.has(field.name ?? ''))) {
      standardCount++
      continue
    }
    const label = (question.label ?? '').replace(/\s+/g, ' ').trim()
    const first = fields[0] ?? {}
    questions.push({
      label,
      required: question.required === true,
      kind: kindOf(first),
      options: (first.values ?? []).map((value) => (value.label ?? '').trim()).filter(Boolean),
      eligibility: ELIGIBILITY.test(label) || (first.values ?? []).some((value) => ELIGIBILITY.test(value.label ?? '') && /sponsor|visa/i.test(value.label ?? '')),
    })
  }
  return { questions, standardCount, deadline: raw.application_deadline ?? null }
}

export const fetchGreenhouseForm = async (board: string, id: string, signal?: AbortSignal): Promise<ApplicationForm> => {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}?questions=true`, { signal })
  if (response.status === 404) throw new Error('Greenhouse says this posting is gone. It may be closed.')
  if (!response.ok) throw new Error(`Greenhouse answered ${response.status}.`)
  return summarizeForm(await response.json() as RawJob)
}

// Added to the Claude in Chrome instructions so the custom questions are known before the form is opened.
export const formPromptBlock = (form: ApplicationForm) => {
  if (form.questions.length === 0) return ''
  const lines = form.questions.map((question) => {
    const tags = [question.required ? 'required' : 'optional', question.kind.replace('_', ' '), question.eligibility ? 'ELIGIBILITY: use my fixed work-authorization answers only' : ''].filter(Boolean)
    const choices = question.options.length > 0 ? ` Options: ${question.options.join(' / ')}.` : ''
    return `- ${question.label} (${tags.join(', ')}).${choices}`
  })
  return `\n\nThe form's own questions, read from the employer's public form (anything not listed here that appears on the page is new: stop and ask me):\n${lines.join('\n')}`
}
