// What a posting asks for, read with rules (no model, nothing sent anywhere): basic vs preferred requirements, years of
// experience, degree, certifications, work-authorization wording, and tool-like terms the known list does not have yet.
// The new terms are for review only. Nothing here edits the vocabulary the resume checks use (TECH_TERMS in packet.ts);
// adding a term is a deliberate change there. Rules in the spirit of spaCy's EntityRuler, written for plain TypeScript.

export type Requirement = { text: string; kind: 'basic' | 'preferred' }
export type Years = { min: number; max: number | null; text: string }
export type Degree = { level: 'associate' | 'bachelor' | 'master' | 'phd'; orEquivalent: boolean; text: string }
export type Certification = { name: string; kind: 'basic' | 'preferred' }
export type EligibilityKind = 'no_sponsorship' | 'sponsorship_offered' | 'citizenship' | 'clearance' | 'e_verify'
export type Eligibility = { kind: EligibilityKind; text: string }
export type PostingRequirements = {
  basic: Requirement[]
  preferred: Requirement[]
  years: Years[]
  degrees: Degree[]
  certifications: Certification[]
  eligibility: Eligibility[]
  newTerms: string[]
}

const PREFERRED_HEADING = /(preferred|nice[ -]to[ -]have|bonus|pluses|is a plus|would be a plus|desired|desirable|extra credit)/i
const REQUIRED_HEADING = /(required|requirements|minimum|basic qualifications|what it takes|must have|you have|qualifications|what you.?ll need|what we.?re looking for|who you are|about you|skills and experience)/i
const OTHER_HEADING = /(work authori|eligib|sponsor|visa|legal|e-verify|diversity|inclusion|accommodation|privacy|how to apply|responsibilit|what you.?ll do|what you will do|the role|about (?:us|the|this)|benefits|perks|compensation|salary|how we|why |our team|overview|summary|equal opportunity|what we offer)/i

const PREFERRED_LINE = /\b(?:preferred|nice to have|a plus|is a bonus|bonus points|desirable|ideally|not required|extra credit|would be great)\b|\bplus\b\s*[.;)]?\s*$/i
const REQUIREMENT_CUE = /\b(?:must|required|minimum|years? of|degree|certif|proficien|experience (?:with|in|using)|knowledge of|familiarity|understanding of|ability to|skilled)/i

const WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const NUMBER = '(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)'
const toNumber = (value: string) => (/^\d/.test(value) ? Number(value) : WORDS[value.toLowerCase()])
const YEARS = new RegExp(`${NUMBER}\\s*(\\+)?\\s*(?:(?:-|–|—|to)\\s*${NUMBER})?\\s*\\+?\\s*(?:years?|yrs?)\\b`, 'i')

const CERTS: RegExp[] = [
  /\bSecurity\+/g, /\bCySA\+/g, /\bPenTest\+/g, /\bCASP\+/g, /\bNetwork\+/g, /\bCISSP\b/g, /\bCISM\b/g, /\bCISA\b/g, /\bCCSP\b/g, /\bCEH\b/g, /\bOSCP\b/g,
  /\bGSEC\b/g, /\bGCIH\b/g, /\bGCIA\b/g, /\bCCNA\b/g, /\bCCNP\b/g, /\bCKA\b/g, /\bCKAD\b/g, /\bCKS\b/g,
  /\b(?:AZ|SC|AI|DP|MS)-\d{3}\b/g, /\bAWS Certified [A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3}/g,
  /\bGoogle Cloud (?:Professional|Associate)(?: [A-Z][A-Za-z]+){1,3}/g, /\bHashiCorp Certified[: ]+[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,2}/g,
  /\bCompTIA [A-Z][A-Za-z]*\+?/g,
]

const DEGREE_LEVELS: Array<{ level: Degree['level']; pattern: RegExp }> = [
  { level: 'phd', pattern: /\b(?:ph\.?d|doctorate|doctoral)\b/i },
  { level: 'master', pattern: /\b(?:master'?s|msc|mba)\b|(?<![A-Za-z])M\.S\.|\bMS\b(?=\s+(?:in|degree|or|and|\/|,))/i },
  { level: 'bachelor', pattern: /\bbachelor'?s?\b|(?<![A-Za-z])B\.[SA]\.|\bBSc\b|\b(?:BS|BA)\b(?=\s+(?:in|degree|or|and|\/|,))/i },
  { level: 'associate', pattern: /\bassociate'?s? degree\b/i },
]

const ELIGIBILITY: Array<{ kind: EligibilityKind; pattern: RegExp }> = [
  { kind: 'no_sponsorship', pattern: /(?:unable|not (?:able|eligible|available|permitted)|cannot|can'?t|will not|won'?t|do(?:es)? not|no)\b[^.]{0,60}\b(?:sponsor|visa)|without (?:the need for )?(?:current or future |future )?(?:visa )?sponsorship|no (?:visa )?sponsorship|not eligible for (?:visa )?sponsorship/i },
  { kind: 'sponsorship_offered', pattern: /(?:visa )?sponsorship (?:is |may be )?(?:available|provided|offered)|\b(?:offer|provide|support)s?\s+(?:h-?1b\s+)?(?:visa\s+)?sponsorship|will (?:provide )?sponsor|(?:we|company) (?:can|do|does) sponsor|sponsor(?:s|ing)? (?:work )?visas?\b/i },
  { kind: 'citizenship', pattern: /\bU\.?S\.? (?:citizen|person)|citizenship|permanent resident|green card|ITAR|export control/i },
  { kind: 'clearance', pattern: /\b(?:security )?clearance\b|polygraph|\bTS\/SCI\b/i },
  { kind: 'e_verify', pattern: /\be-?verify\b/i },
]

// Capitalised words that are not tools: sentence furniture, degrees, generic fields, states.
const STOP = new Set(`a an and or the of in on to for with by at as is are be we you our your their this that these those it its from into over under
  experience experiences strong knowledge ability abilities familiarity understanding proficiency proficient skills skill demonstrated proven excellent good solid
  working work well plus preferred required requirements responsibilities qualifications qualification basic minimum bonus desired ideally equivalent related field fields
  bachelor bachelors master masters degree degrees phd doctorate associate university college school computer science engineering information technology systems system
  software hardware network networks networking security cyber cybersecurity cloud data infrastructure operations operation development developer engineer engineers
  analyst analysts management manager team teams business technical communication communications written verbal problem solving analytical critical thinking
  years year months month least more than including include such able must should will can may one two three four five six seven eight nine ten
  ai saas api apis pto hra us usa u.s u.s. uk eu eeo eoe ada fmla covid hr it id ok am pm est pst cst edt cdt mst remote hybrid onsite full part time fulltime parttime intern internship
  new united states north carolina nc ca ny tx va ma ga fl wa il oh pa nj md co az mn
  bs ba ms ma mba cs ece its so if all any each other others etc via per using use used based high level highly entry mid senior junior lead principal staff
  application applications environment environments platform platforms tool tools process processes practice practices principle principles standard standards
  framework frameworks language languages technology technologies solution solutions service services support product products customer customers client clients
  project projects program programs role roles position positions candidate candidates employee employees applicant applicants company companies industry`.split(/\s+/).filter(Boolean))

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isKnown = (term: string, known: string[]) => known.some((entry) => new RegExp(`(?<![A-Za-z0-9])${escapeRegex(entry)}(?![A-Za-z0-9])`, 'i').test(term))

const heading = (line: string) => {
  const trimmed = line.trim().replace(/[:：]\s*$/, '')
  if (!trimmed || /^[•·*\-–\d]/.test(line.trim())) return null
  const capsLine = (() => { const l = trimmed.replace(/[^A-Za-z]/g, ''); return l.length >= 4 && l === l.toUpperCase() })()
  if (!(line.trim().endsWith(':') || trimmed.split(/\s+/).length <= 7 || capsLine)) return null
  if (/[.!?]$/.test(trimmed)) return null
  const letters = trimmed.replace(/[^A-Za-z]/g, '')
  const allCaps = letters.length >= 4 && letters === letters.toUpperCase() && trimmed.split(/\s+/).length >= 2
  if (PREFERRED_HEADING.test(trimmed)) return 'preferred' as const
  if (REQUIRED_HEADING.test(trimmed)) return 'basic' as const
  if (OTHER_HEADING.test(trimmed)) return 'other' as const
  if (allCaps) return 'unknown' as const
  // An unrecognised short title-case line ("Our Benefits") still ends the section before it.
  const small = new Set(['of', 'and', 'the', 'to', 'for', 'in', 'on', 'at', 'a', 'an', 'with'])
  const words = trimmed.split(/\s+/)
  if (words.length <= 5 && !/[.!?;,]$/.test(trimmed) && words.every((word) => /^[A-Z]/.test(word) || small.has(word.toLowerCase()))) return 'unknown' as const
  return null
}

// A posting's lines, each with the kind of section it sits in (basic / preferred / none).
const classify = (posting: string): Array<{ text: string; kind: 'basic' | 'preferred' | null }> => {
  let section: 'basic' | 'preferred' | 'other' | 'unknown' | null = null
  let bulletsSeen = false
  const out: Array<{ text: string; kind: 'basic' | 'preferred' | null }> = []
  for (const raw of posting.split(/\n/)) {
    const line = raw.replace(/^[\s•·*\-–]+/, '').replace(/\s+/g, ' ').trim()
    if (!line) continue
    const h = heading(raw)
    if (h) {
      section = h
      bulletsSeen = false
      continue
    }
    const bullet = /^\s*[•·*\-–]/.test(raw)
    if (bullet) bulletsSeen = true
    // A long paragraph after a bullet list is prose again (culture, benefits), not another requirement.
    else if (bulletsSeen && line.length > 80 && (section === 'basic' || section === 'preferred')) section = 'unknown'
    // A long paragraph can hold several sentences; judge each.
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const text = sentence.trim()
      if (text.length < 4) continue
      const preferredLine = PREFERRED_LINE.test(text)
      let kind: 'basic' | 'preferred' | null = null
      if (section === 'preferred') kind = 'preferred'
      else if (section === 'basic') kind = preferredLine ? 'preferred' : 'basic'
      else if ((section === null || section === 'unknown') && REQUIREMENT_CUE.test(text)) kind = preferredLine ? 'preferred' : 'basic'
      out.push({ text, kind })
    }
  }
  return out
}

const termRuns = (line: string): string[] => {
  const tokens = line.replace(/[()[\]{}"“”;:,]/g, ' , ').split(/\s+/).filter(Boolean)
  const runs: string[] = []
  let run: string[] = []
  const flush = () => {
    if (run.length > 0) runs.push(run.slice(0, 3).join(' '))
    run = []
  }
  tokens.forEach((token, index) => {
    const word = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, '')
    const termish = word.length >= 2 && !STOP.has(word.toLowerCase()) && (
      /^[A-Z]{2,6}[0-9]?$/.test(word)                      // SIEM, GRC, SAST
      || /[a-z][A-Z]|[A-Z][a-z]+[A-Z]/.test(word)           // CrowdStrike, GitHub
      || /^[A-Za-z][A-Za-z0-9]*[+#]$/.test(word) || /^[A-Za-z]+\.[A-Za-z]{2,}$/.test(word) // C#, Security+, Node.js
      || (/^[A-Z][a-z0-9]{2,}$/.test(word) && index > 0 && !/[.!?]$/.test(tokens[index - 1])) // mid-sentence capitalised
    )
    if (termish) run.push(word)
    else flush()
  })
  flush()
  return runs
}

export const extractRequirements = (posting: string, known: string[] = [], ignore: string[] = []): PostingRequirements => {
  const lines = classify(posting)
  const basic: Requirement[] = []
  const preferred: Requirement[] = []
  const years: Years[] = []
  const degrees: Degree[] = []
  const certifications: Certification[] = []
  const eligibility: Eligibility[] = []
  const candidates = new Map<string, number>()
  const seenCert = new Set<string>()

  for (const { text, kind } of lines) {
    for (const rule of ELIGIBILITY) {
      // "does not offer sponsorship" is a refusal, not an offer.
      if (rule.kind === 'sponsorship_offered' && ELIGIBILITY[0].pattern.test(text)) continue
      if (rule.pattern.test(text) && !eligibility.some((entry) => entry.text === text)) eligibility.push({ kind: rule.kind, text: text.slice(0, 300) })
    }
    if (!kind) continue
    ;(kind === 'basic' ? basic : preferred).push({ text: text.slice(0, 300), kind })

    if (kind === 'basic') {
      const match = YEARS.exec(text)
      if (match) {
        const first = toNumber(match[1])
        const second = match[3] ? toNumber(match[3]) : null
        years.push({ min: first, max: second ?? (match[2] ? null : first), text: text.slice(0, 300) })
      }
    }
    for (const { level, pattern } of DEGREE_LEVELS) {
      if (pattern.test(text)) {
        if (kind === 'basic' || !degrees.some((entry) => entry.level === level)) degrees.push({ level, orEquivalent: /equivalent|in lieu of|or related experience|or comparable/i.test(text), text: text.slice(0, 300) })
        break
      }
    }
    for (const pattern of CERTS) {
      for (const match of text.matchAll(pattern)) {
        const name = match[0].replace(/[ ,.;]+$/, '')
        if (seenCert.has(name)) continue
        seenCert.add(name)
        certifications.push({ name, kind })
      }
    }
    for (const run of termRuns(text)) {
      if (isKnown(run, known) || ignore.some((name) => name.length >= 2 && run.toLowerCase().split(' ').includes(name.toLowerCase())) || CERTS.some((pattern) => new RegExp(pattern.source).test(run))) continue
      candidates.set(run, (candidates.get(run) ?? 0) + 1)
    }
  }
  // "Security+" and "CompTIA Security+" are one certification: keep the fuller name.
  const distinct = certifications.filter((cert) => !certifications.some((other) => other !== cert && other.name.length > cert.name.length && other.name.includes(cert.name)))
  return {
    basic, preferred, years, degrees, certifications: distinct, eligibility,
    // Tool-shaped terms (acronyms, CamelCase, C#) before plain capitalised words, then by how often the posting repeats them.
    newTerms: [...candidates.entries()]
      .sort((a, b) => Number(/^[A-Z][a-z0-9]+$/.test(a[0])) - Number(/^[A-Z][a-z0-9]+$/.test(b[0])) || b[1] - a[1])
      .map(([term]) => term).slice(0, 12),
  }
}

// One line for the summary: the entry-level read of the years asked.
export const yearsSummary = (years: Years[]) => {
  if (years.length === 0) return null
  const top = years.reduce((best, entry) => (entry.min > best.min ? entry : best))
  return top.max !== null && top.max !== top.min ? `${top.min}–${top.max} years` : top.max === null ? `${top.min}+ years` : `${top.min} year${top.min === 1 ? '' : 's'}`
}
