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
  /\bpolygraph\b/i,
  /\b(active|current|obtain|maintain|eligible|eligibility)\b[^.]{0,40}\bclearance\b/i,
  /\bclearance\b[^.]{0,40}\b(required|eligib\w*|obtain|maintain|active)\b/i,
]
// These always mean a clearance, even when phrased conditionally.
const CLEARANCE_DEFINITE = /\bts\s*\/\s*sci\b|\bpolygraph\b|\b(active|current) (\w+ )?clearance\b/i
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
    newGradSignal: NEW_GRAD.test(posting.title) || NEW_GRAD.test(description),
    internship: INTERNSHIP.test(posting.title),
    rotational: ROTATIONAL.test(posting.title) || /\brotational\b/i.test(description),
    requiredYears: years.length > 0 ? Math.min(...years) : null,
    workMode: workModeOf(posting, description),
    descriptionAvailable: description.trim() !== '',
  }
}
