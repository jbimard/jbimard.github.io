// Screening result schema: what the Claude routine sends for each job, checked before anything is written.
// supabase/functions/job-screening/validation.ts must stay an exact copy of this file (results.test.ts checks).
// No imports, so the same file runs under Node and Deno.

export const RECOMMENDATIONS = ['apply', 'maybe', 'skip'] as const
export const RESUME_VERSIONS = ['Cloud', 'Security', 'Cloud Security'] as const
export const SPONSORSHIP_VERDICTS = ['ok', 'no_sponsorship', 'unclear'] as const
export const CITIZENSHIP_VERDICTS = ['none', 'required', 'unclear'] as const
export const CLEARANCE_VERDICTS = ['none', 'conditional', 'required'] as const
export const USCIS_TIERS = ['strong', 'some', 'rare', 'none'] as const
// discovery: the USCIS line discovery wrote is right. corrected: Claude found the right employer itself.
export const USCIS_SOURCES = ['discovery', 'corrected', 'none'] as const

export const REASON_LIMIT = 600
export const NOTE_LIMIT = 300
export const ITEM_LIMIT = 160
export const MAX_ITEMS = 3

type Check<Verdict> = { verdict: Verdict; note: string }

export type UscisCheck = {
  employer: string | null
  fiscalYear: number | null
  count: number | null
  tier: (typeof USCIS_TIERS)[number]
  source: (typeof USCIS_SOURCES)[number]
}

export type ScreeningResult = {
  id: string
  score: number
  recommendation: (typeof RECOMMENDATIONS)[number]
  reason: string
  strengths: string[]
  gaps: string[]
  resume_version: (typeof RESUME_VERSIONS)[number]
  checks: {
    sponsorship: Check<(typeof SPONSORSHIP_VERDICTS)[number]> & { uscis: UscisCheck }
    citizenship: Check<(typeof CITIZENSHIP_VERDICTS)[number]>
    clearance: Check<(typeof CLEARANCE_VERDICTS)[number]>
  }
}

// Stored in jobs.screening: the result without its id, plus what it replaced and who wrote it.
export type StoredScreening = Omit<ScreeningResult, 'id'> & { rule_score: number | null; screened_by: string }

// Same cut-offs as automation/rules/score.ts.
export const priorityOf = (score: number) => (score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)

export const validateScreeningResult = (input: unknown): { result: ScreeningResult | null; errors: string[] } => {
  const errors: string[] = []
  if (!isObj(input)) return { result: null, errors: ['result must be an object.'] }

  const text = (path: string, value: unknown, limit: number) => {
    if (typeof value !== 'string' || value.trim() === '') errors.push(`${path} must be a non-empty string.`)
    else if (value.length > limit) errors.push(`${path} must be at most ${limit} characters.`)
  }
  const oneOf = (path: string, value: unknown, options: readonly string[]) => {
    if (typeof value !== 'string' || !options.includes(value)) errors.push(`${path} must be one of: ${options.join(', ')}.`)
  }
  const list = (path: string, value: unknown) => {
    if (!Array.isArray(value) || value.length > MAX_ITEMS) {
      errors.push(`${path} must be an array of at most ${MAX_ITEMS} strings.`)
      return
    }
    value.forEach((item, i) => text(`${path}[${i}]`, item, ITEM_LIMIT))
  }
  const check = (path: string, value: unknown, verdicts: readonly string[]) => {
    if (!isObj(value)) {
      errors.push(`${path} must be an object.`)
      return null
    }
    oneOf(`${path}.verdict`, value.verdict, verdicts)
    text(`${path}.note`, value.note, NOTE_LIMIT)
    return value
  }

  if (typeof input.id !== 'string' || !UUID.test(input.id)) errors.push('id must be a job UUID.')
  if (!Number.isInteger(input.score) || (input.score as number) < 0 || (input.score as number) > 100) {
    errors.push('score must be an integer from 0 to 100.')
  }
  oneOf('recommendation', input.recommendation, RECOMMENDATIONS)
  text('reason', input.reason, REASON_LIMIT)
  list('strengths', input.strengths)
  list('gaps', input.gaps)
  oneOf('resume_version', input.resume_version, RESUME_VERSIONS)

  if (!isObj(input.checks)) {
    errors.push('checks must be an object.')
  } else {
    const sponsorship = check('checks.sponsorship', input.checks.sponsorship, SPONSORSHIP_VERDICTS)
    check('checks.citizenship', input.checks.citizenship, CITIZENSHIP_VERDICTS)
    const clearance = check('checks.clearance', input.checks.clearance, CLEARANCE_VERDICTS)

    if (sponsorship) {
      const uscis = sponsorship.uscis
      if (!isObj(uscis)) {
        errors.push('checks.sponsorship.uscis must be an object.')
      } else {
        oneOf('checks.sponsorship.uscis.tier', uscis.tier, USCIS_TIERS)
        oneOf('checks.sponsorship.uscis.source', uscis.source, USCIS_SOURCES)
        if (uscis.source === 'none') {
          if (uscis.employer !== null || uscis.count !== null) errors.push('checks.sponsorship.uscis: employer and count must be null when source is "none".')
        } else {
          text('checks.sponsorship.uscis.employer', uscis.employer, ITEM_LIMIT)
          if (!Number.isInteger(uscis.count) || (uscis.count as number) < 0) errors.push('checks.sponsorship.uscis.count must be a whole number.')
        }
        if (uscis.fiscalYear !== null && (!Number.isInteger(uscis.fiscalYear) || (uscis.fiscalYear as number) < 2009)) {
          errors.push('checks.sponsorship.uscis.fiscalYear must be a fiscal year or null.')
        }
      }
    }
    // Decision log: a required clearance can never work out (citizenship), so it is always a skip.
    if (clearance?.verdict === 'required' && input.recommendation !== 'skip') {
      errors.push('recommendation must be "skip" when checks.clearance.verdict is "required".')
    }
  }

  return { result: errors.length === 0 ? (input as ScreeningResult) : null, errors }
}

export const toStoredScreening = (result: ScreeningResult, ruleScore: number | null, screenedBy: string): StoredScreening => ({
  score: result.score,
  recommendation: result.recommendation,
  reason: result.reason,
  strengths: result.strengths,
  gaps: result.gaps,
  resume_version: result.resume_version,
  checks: result.checks,
  rule_score: ruleScore,
  screened_by: screenedBy,
})
