import type { RawPosting } from '../types.ts'
import { sentences } from './text.ts'

export type Flags = {
  // Each text flag holds the sentence that triggered it, so the dashboard can quote it.
  clearance: string | null
  // Conditional wording ("may require… depending on site") — labeled, not blocked.
  possibleClearance: string | null
  citizenship: string | null
  noSponsorship: string | null
  sponsorshipOffered: string | null
  eVerify: string | null
  returnToSchool: string | null
  graduation: string | null
  // Graduation / program year the posting targets (2027 = Joseph's year).
  targetYear: number | null
  // The graduation dates the posting accepts, as months (year * 12 + month), from the graduation sentence.
  graduationWindow: GraduationWindow | null
  // When an internship named "Summer 2027" etc. starts (year * 12 + month); null for other roles or no term.
  internshipStart: number | null
  newGradSignal: boolean
  internship: boolean
  rotational: boolean
  requiredYears: number | null
  workMode: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'
  descriptionAvailable: boolean
}

const CLEARANCE = [
  /\b(security|secret|top secret|ts\/sci|dod|government|federal|public trust) clearance\b/i,
  /\bts\s*\/\s*sci\b/i,
  // Not the "Employee Polygraph Protection Act" in EEO footers (a law limiting polygraphs, e.g. Deutsche Bank's).
  /\bpolygraph\b(?!\s+protection)/i,
  /\b(active|current|obtain|maintain|eligible|eligibility)\b[^.]{0,40}\bclearance\b/i,
  /\bclearance\b[^.]{0,40}\b(required|eligib\w*|obtain|maintain|active)\b/i,
]
// These always mean a clearance, even when phrased conditionally.
const CLEARANCE_DEFINITE = /\bts\s*\/\s*sci\b|\bpolygraph\b(?!\s+protection)|\b(active|current) (\w+ )?clearance\b/i
const CONDITIONAL = /\bmay (be )?requir\w*|\bdepending on\b|\bmight (be )?requir\w*|\bpreferred\b|\ba plus\b/i
const CLEARANCE_NEGATED = /\bno (security )?clearance\b|\bnot require (a |any )?(security )?clearance\b|\bclearance (is )?not required\b/i

const CITIZENSHIP = /\b(u\.?\s?s\.?|united states|american) citizens?(hip)?\b|\bcitizenship\b|\bu\.?\s?s\.? persons?\b/i
const CITIZENSHIP_REQUIRED = /\b(must|required?|requires|requirement|only|eligib\w*|need|mandatory|restricted)\b/i
// EEO boilerplate mentions citizenship without requiring it.
const CITIZENSHIP_BOILERPLATE = /citizenship status|regardless of|without regard|irrespective|discriminat|protected|equal (employment )?opportunity/i

const NO_SPONSORSHIP = [
  /\b(not|unable to|cannot|can't|won't|will not|no|does not|do not|doesn't|don't)\b[^.]{0,50}\bsponsor/i,
  /\bwithout (the need for )?([a-z-]+ ){0,4}sponsorship\b/i,
  /\bsponsorship (is |will )?(not |un)(be )?(available|offered|provided)\b/i,
]
const SPONSORSHIP_OFFERED = [
  /\b(will|can|able to|do|does|happy to|we)\b[^.]{0,20}\b(provide|offer|support|sponsor)\b[^.]{0,30}\b(visa|sponsorship|h-?1b)\b/i,
  /\b(visa|h-?1b) sponsorship (is )?(available|offered|provided)\b/i,
]

const E_VERIFY = /\be-?verify\b/i
const RETURN_TO_SCHOOL = /\b(return(ing)? to (school|university|campus|your studies)|continu\w* (your )?(education|studies|enrollment) after|at least one (semester|quarter|term) remaining)\b/i
const GRADUATION = /\b(graduat\w*|class of|degree|program start|start date)\b[^.]{0,80}\b(20(2[5-9]))\b|\b(20(2[5-9]))\b[^.]{0,40}\bgraduat/i

// Dates like "May 2027" or "Fall 2027" ("Spring '27" isn't matched).
const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  // Seasons as the month a term usually ends (for graduation) …
  spring: 5, summer: 8, fall: 12, autumn: 12, winter: 12,
}
// … and as the month an internship term starts.
const TERM_STARTS: Record<string, number> = { spring: 1, summer: 6, fall: 9, autumn: 9, winter: 1 }
const DATE_MENTION = /\b(?:(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|spring|summer|fall|autumn|winter)\.?\s+)?(20(?:2[5-9]|3[0-2]))\b/gi
const TERM_TITLE = /\b(spring|summer|fall|autumn|winter)\s*'?(20\d\d)\b/i

export type GraduationWindow = { from: number; to: number }

// The graduation dates a sentence accepts. Two or more dates are a range; one date is that month (or that whole
// year when no month is given), or anything up to it after "by" / "before" / "no later than".
export const graduationWindow = (sentence: string): GraduationWindow | null => {
  const dates = [...sentence.matchAll(DATE_MENTION)].map((match) => {
    const word = match[1]?.toLowerCase()
    const month = word ? MONTH_NUMBERS[word] ?? MONTH_NUMBERS[word.slice(0, 3)] : null
    return { year: Number(match[2]), month }
  })
  if (dates.length === 0) return null
  if (dates.length === 1 && /\b(by|before|no later than|prior to)\b/i.test(sentence)) {
    return { from: 0, to: dates[0].year * 12 + (dates[0].month ?? 12) }
  }
  // Postings list dates in either order ("Spring 2028 or Fall 2027"), so the window is earliest to latest.
  return {
    from: Math.min(...dates.map((date) => date.year * 12 + (date.month ?? 1))),
    to: Math.max(...dates.map((date) => date.year * 12 + (date.month ?? 12))),
  }
}

const NEW_GRAD = /\b(new grad|new graduate|university grad\w*|recent grad\w*|college grad\w*|early career|early-career|entry[- ]level|campus hire|class of 202[67]|graduate program|0\s*[-–]\s*2 years|associate program|analyst program)\b/i
const INTERNSHIP = /\bintern\b|\binternship\b|\bco-?op\b/i
const ROTATIONAL = /\brotational\b|\brotation program\b|\b(development|technology|leadership|early talent) program\b/i
const YEARS_REQUIRED = /\b(\d{1,2})\s*\+?\s*(?:or more\s*)?(?:[-–]\s*\d{1,2}\s*)?years?['’]?\s*(?:of\s*)?(?:[a-z/,&-]+\s+){0,4}?experience\b/gi

const firstSentence = (all: string[], test: (sentence: string) => boolean) => all.find(test) ?? null

const workModeOf = (posting: RawPosting, text: string): Flags['workMode'] => {
  const hint = `${posting.workplaceHint ?? ''} ${posting.location}`.toLowerCase()
  if (/hybrid/.test(hint)) return 'Hybrid'
  if (/remote/.test(hint)) return 'Remote'
  if (/on-?site|in[- ]office/.test(hint)) return 'Onsite'
  if (/\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/\b(on-?site|in[- ]office) (role|position)\b|\bfully on-?site\b/i.test(text)) return 'Onsite'
  return 'Unknown'
}

export const detectFlags = (posting: RawPosting): Flags => {
  const description = posting.description ?? ''
  const all = sentences(`${posting.title}.\n${description}`)

  const clearanceSentences = all.filter((s) => CLEARANCE.some((re) => re.test(s)) && !CLEARANCE_NEGATED.test(s))
  const clearance = clearanceSentences.find((s) => CLEARANCE_DEFINITE.test(s) || !CONDITIONAL.test(s)) ?? null
  const possibleClearance = clearance ? null : clearanceSentences[0] ?? null
  let citizenship = firstSentence(all, (s) => CITIZENSHIP.test(s) && CITIZENSHIP_REQUIRED.test(s) && !CITIZENSHIP_BOILERPLATE.test(s))
  let noSponsorship = firstSentence(all, (s) => NO_SPONSORSHIP.some((re) => re.test(s)))
  let sponsorshipOffered = noSponsorship ? null : firstSentence(all, (s) => SPONSORSHIP_OFFERED.some((re) => re.test(s)))

  switch (posting.simplifySponsorship) {
    case 'U.S. Citizenship is Required':
      citizenship ??= 'Simplify lists this role as "U.S. Citizenship is Required".'
      break
    case 'Does Not Offer Sponsorship':
      noSponsorship ??= 'Simplify lists this role as "Does Not Offer Sponsorship".'
      sponsorshipOffered = null
      break
    case 'Offers Sponsorship':
      if (!noSponsorship) sponsorshipOffered ??= 'Simplify lists this role as "Offers Sponsorship".'
      break
  }

  const graduation = firstSentence(all, (s) => GRADUATION.test(s))
  const titleYear = posting.title.match(/\b(20(2[5-9]))\b/)
  const graduationYear = graduation?.match(GRADUATION)
  const targetYear = titleYear
    ? Number(titleYear[1])
    : graduationYear ? Number(graduationYear[2] ?? graduationYear[4]) : null

  const internship = INTERNSHIP.test(posting.title)
  const term = posting.title.match(TERM_TITLE)

  const years = [...description.matchAll(YEARS_REQUIRED)].map((match) => Number(match[1])).filter((n) => n > 0 && n < 20)

  return {
    clearance,
    possibleClearance,
    citizenship,
    noSponsorship,
    sponsorshipOffered,
    eVerify: firstSentence(all, (s) => E_VERIFY.test(s)),
    returnToSchool: firstSentence(all, (s) => RETURN_TO_SCHOOL.test(s)),
    graduation,
    targetYear,
    graduationWindow: graduation ? graduationWindow(graduation) : null,
    internshipStart: internship && term ? Number(term[2]) * 12 + TERM_STARTS[term[1].toLowerCase()] : null,
    newGradSignal: NEW_GRAD.test(posting.title) || NEW_GRAD.test(description),
    internship,
    rotational: ROTATIONAL.test(posting.title) || /\brotational\b/i.test(description),
    requiredYears: years.length > 0 ? Math.min(...years) : null,
    workMode: workModeOf(posting, description),
    descriptionAvailable: description.trim() !== '',
  }
}
