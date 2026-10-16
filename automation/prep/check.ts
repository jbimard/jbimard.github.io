// Resume check (step 3c): reads a validated packet against the base resumes and the experience inventory and
// flags what a careful human reviewer would. Deterministic, no AI. Red flags block approval; yellow ones need a look.
// supabase/functions/_shared/check.ts must stay an exact copy of this file (check.test.ts checks).
import {
  RESUME_VERSIONS,
  allBaseText,
  buildVocabulary,
  courseText,
  resolveResume,
  retention,
  splitSkills,
  type BaseResumes,
  type Packet,
  type ResolvedResume,
} from './packet.ts'

export type Severity = 'red' | 'yellow'
export type Flag = { id: string; severity: Severity; rule: string; path: string; message: string; text?: string }
export type DiffPart = ['=' | '-' | '+', string]
export type Comparison = { path: string; source: string; text: string; diff: DiffPart[] }
export type KeywordCoverage = { covered: string[]; missing: string[] }
export type Ats = { score: number | null; base_score: number | null; required: KeywordCoverage; preferred: KeywordCoverage }
export type CheckStatus = 'pass' | 'needs_edits' | 'blocked'
export type CheckResult = { status: CheckStatus; flags: Flag[]; comparisons: Comparison[]; ats: Ats }
export type PostingFields = { required_skills: string | null; job_description: string | null }

// ---------- word lists ----------

// Lead-verb ladder: a tailored bullet may keep or lower its source's level, never raise it.
const VERB_LEVELS: Array<[number, string[]]> = [
  [0, ['assist', 'support', 'help', 'contribut', 'participat', 'collaborat', 'facilitat', 'engag', 'shadow', 'aid']],
  [2, ['led', 'lead', 'manag', 'own', 'direct', 'spearhead', 'head', 'supervis', 'mentor', 'oversaw', 'oversee', 'champion', 'drove', 'drive']],
]
// Everyday action verbs sit in the middle (build, design, architect, implement, investigate…).
const MIDDLE_PREFIXES = ['re-architect', 'rearchitect', 'architect', 'redesign', 're-design']
const LEADERSHIP_WORDS = /\b(led|lead|leading|managed|manage|managing|owned|directed|spearheaded|headed|supervised|mentored|oversaw)\b/gi

// "advanced hunting" is a Defender feature, not a skill claim.
const LEVEL_WORDS = '(?:expert|expertise|advanced(?!\\s+(?:hunting|threat))|proficient|proficiency|extensive|deep|mastery)'
const BUZZWORDS = [
  'leverage', 'leveraged', 'leveraging', 'spearheaded', 'seamless', 'seamlessly', 'robust', 'cutting-edge', 'passionate',
  'results-driven', 'dynamic', 'synergy', 'synergies', 'orchestrated', 'pivotal', 'fast-paced', 'game-changer', 'innovative',
  'best-in-class', 'world-class', 'thought leader', 'go-getter', 'detail-oriented', 'self-starter', 'hard-working',
]
const VAGUE = ['various', 'numerous', 'a wide range of', 'a variety of', 'myriad', 'plethora', 'countless', 'many different']
const CERTIFICATIONS = [
  'Security+', 'Network+', 'A+', 'CySA+', 'PenTest+', 'CASP+', 'CISSP', 'CCSP', 'CISM', 'CISA', 'CEH', 'OSCP', 'GSEC', 'GCIH',
  'CCNA', 'CCNP', 'AZ-900', 'AZ-104', 'AZ-500', 'SC-200', 'SC-300', 'SC-900', 'AWS Certified', 'CKA', 'CKAD', 'Terraform Associate',
]
const PROGRESS_WORDS = /\b(in progress|expected|pursuing|studying for|preparing for|scheduled)\b/i
const COURSE_WORDS = /\b(course|courses|coursework|class|classes)\b/i
const CURRENT_WORDS = /\b(currently|this semester|this fall|this spring|in progress|taking|enrolled)\b/i
// Read-aloud pass: lines that trip you up when spoken, the way a recruiter skims them.
const LONG_SENTENCE_WORDS = 35
const DUTY_OPENERS = /^(responsible for|duties included|tasked with|in charge of|worked on)\b/i
const PASSIVE = /\b(?:was|were|is|are|been|being)\s+(?:[a-z]+ed|built|made|done|run|written|given|taken|set up)\b/i
const PREFERRED_HEADING =/(preferred|nice[ -]to[ -]have|bonus|pluses|is a plus|would be a plus|desired|desirable)/i
const REQUIRED_HEADING = /(required|requirements|minimum|basic qualifications|what it takes|must have|you have|qualifications)/i

// ---------- helpers ----------

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const termPattern = (term: string, flags = '') => new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9+])`, flags)

// Spelled-out acronyms in a line, by acronym: "SIEM (Security Information and Event Management)" or the reverse.
// Only counts when the capitalized words' initials spell the acronym, so "Splunk (SIEM)" isn't one.
const initials = (words: string) => (words.match(/\b[A-Z]/g) ?? []).join('')
const expansionsIn = (text: string) => {
  const found = new Set<string>()
  for (const [, acronym, words] of text.matchAll(/\b([A-Z]{2,})\s*\(([^)]+)\)/g)) if (initials(words) === acronym) found.add(acronym)
  for (const match of text.matchAll(/\(([A-Z]{2,})\)/g)) {
    const before = text.slice(0, match.index).trim().split(/\s+/)
    const capitalized = before.filter((word) => /^[A-Z]/.test(word))
    if (initials(capitalized.slice(-match[1].length).join(' ')) === match[1] && /^[A-Z]/.test(before.at(-1) ?? '')) found.add(match[1])
  }
  return [...found]
}

const verbLevel = (sentence: string): number | null => {
  const word = sentence.trim().toLowerCase().match(/^[a-z-]+/)?.[0]
  if (!word) return null
  if (MIDDLE_PREFIXES.some((prefix) => word.startsWith(prefix))) return 1
  for (const [level, stems] of VERB_LEVELS) if (stems.some((stem) => word.startsWith(stem))) return level
  return /(ed|ing)$/.test(word) || /^(wrote|made|built|ran|drew|took|gave|kept)$/.test(word) ? 1 : null
}
const leadVerb = (sentence: string) => sentence.trim().toLowerCase().match(/^[a-z-]+/)?.[0] ?? ''

// Word-level diff (longest common subsequence), for the side-by-side view.
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = before.split(/\s+/).filter(Boolean)
  const b = after.split(/\s+/).filter(Boolean)
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const parts: DiffPart[] = []
  const push = (op: DiffPart[0], word: string) => {
    const last = parts[parts.length - 1]
    if (last && last[0] === op) last[1] += ` ${word}`
    else parts.push([op, word])
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('=', a[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('-', a[i++])
    else push('+', b[j++])
  }
  while (i < a.length) push('-', a[i++])
  while (j < b.length) push('+', b[j++])
  return parts
}

// ---------- ATS estimate ----------

// Known terms in the posting, each classed by the section heading it falls under.
export const postingKeywords = (posting: string, terms: string[]) => {
  const lines = posting.split(/\n/)
  const sectionAt: Array<{ index: number; preferred: boolean }> = []
  let offset = 0
  for (const line of lines) {
    // A heading: not a bullet, and either ends with ":" or is a few words ("Preferred qualifications").
    const trimmed = line.trim()
    const heading = !/^[•·*\-–\d]/.test(trimmed) && (trimmed.endsWith(':') || trimmed.split(/\s+/).length <= 6)
    if (heading && PREFERRED_HEADING.test(trimmed)) sectionAt.push({ index: offset, preferred: true })
    else if (heading && REQUIRED_HEADING.test(trimmed)) sectionAt.push({ index: offset, preferred: false })
    offset += line.length + 1
  }
  const required: string[] = []
  const preferred: string[] = []
  const seen = new Set<string>()
  for (const term of terms) {
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    const match = termPattern(term).exec(posting)
    if (!match) continue
    seen.add(key)
    const section = sectionAt.filter((entry) => entry.index <= match.index).pop()
    ;(section?.preferred ? preferred : required).push(term)
  }
  return { required, preferred }
}

const atsScore = (required: string[], preferred: string[], text: string) => {
  const covered = (terms: string[]) => terms.filter((term) => termPattern(term).test(text))
  const req = covered(required)
  const pref = covered(preferred)
  const total = 2 * required.length + preferred.length
  // 15 points for format safety: the fixed template is always single-column with standard headings.
  const score = required.length + preferred.length < 3 ? null : Math.round((85 * (2 * req.length + pref.length)) / total + 15)
  return { score, req, pref }
}

const resumeText = (resume: ResolvedResume) => [
  resume.summary,
  ...resume.coursework,
  ...resume.certifications,
  ...[...resume.experience, ...resume.projects].flatMap((entry) => [entry.heading, entry.subheading ?? '', ...entry.bullets]),
  ...resume.skills.flatMap((group) => group.items),
].join('\n')

// ---------- the check ----------

export const checkPacket = (packet: Packet, base: BaseResumes, resume: ResolvedResume, job: PostingFields): CheckResult => {
  const flags: Flag[] = []
  const add = (severity: Severity, rule: string, path: string, message: string, text?: string) => {
    const id = `${rule}:${path}:${flags.filter((flag) => flag.rule === rule && flag.path === path).length}`
    flags.push({ id, severity, rule, path, message, ...(text ? { text } : {}) })
  }
  const inventory = base.inventory
  const vocabulary = buildVocabulary(base, splitSkills(job.required_skills))
  const baseText = RESUME_VERSIONS.map((version) => {
    const doc = base.versions[version]
    return [doc.summary, ...[...doc.experience, ...doc.projects].flatMap((entry) => entry.bullets.map((bullet) => bullet.text))].join('\n')
  }).join('\n')

  // Every piece of text the packet adds, with where it lives.
  const bullets = [
    ...resume.experience.flatMap((entry, i) => entry.bullets.map((text, j) => ({ path: `experience[${i}].bullets[${j}]`, text, source: entry.sources[j]?.text ?? '' }))),
    ...resume.projects.flatMap((entry, i) => entry.bullets.map((text, j) => ({ path: `projects[${i}].bullets[${j}]`, text, source: entry.sources[j]?.text ?? '' }))),
  ]
  const prose = [
    { path: 'summary', text: resume.summary },
    ...packet.cover_letter.paragraphs.map((text, i) => ({ path: `cover_letter.paragraphs[${i}]`, text })),
    ...Object.entries(packet.answers).map(([key, text]) => ({ path: `answers.${key}`, text })),
  ]
  const everything = [...bullets, ...prose]

  // Red: a bullet claims a higher level of responsibility than its source.
  for (const bullet of bullets) {
    const before = verbLevel(bullet.source)
    const after = verbLevel(bullet.text)
    if (before !== null && after !== null && after > before) {
      add('red', 'verb_inflation', bullet.path, `"${leadVerb(bullet.source)}" became "${leadVerb(bullet.text)}": a higher level of responsibility than the source.`, bullet.text)
    }
    const sourceLeadership = new Set((bullet.source.match(LEADERSHIP_WORDS) ?? []).map((word) => word.toLowerCase()))
    for (const word of new Set((bullet.text.match(LEADERSHIP_WORDS) ?? []).map((w) => w.toLowerCase()))) {
      if (!sourceLeadership.has(word)) add('red', 'verb_inflation', bullet.path, `Says "${word}", which the source bullet doesn't.`, bullet.text)
    }
  }

  // Red: expert-level claims about tools he has only used; yellow: expert claims about anything else.
  for (const { path, text } of everything) {
    let toolClaim = false
    for (const tool of inventory?.tools ?? []) {
      const claim = new RegExp(`${LEVEL_WORDS}\\W+(?:[A-Za-z/&.+#-]+\\W+){0,3}${escapeRegex(tool.name)}(?![A-Za-z0-9])`, 'i')
      if (!claim.test(text)) continue
      toolClaim = true
      if (tool.depth === 'used') add('red', 'level_inflation', path, `Claims expert-level ${tool.name}; the inventory says "used".`, text)
      else if (tool.depth === 'built' && /\b(expert|expertise|mastery)\b/i.test(text)) add('yellow', 'level_claim', path, `"Expert" in ${tool.name} is a strong claim for "built with" experience.`, text)
    }
    if (!toolClaim && new RegExp(`\\b${LEVEL_WORDS}\\b`, 'i').test(text)) {
      add('yellow', 'level_claim', path, 'Contains an expert-level claim; make sure the base resumes back it up.', text)
    }
  }

  // Red: tools or platforms that aren't in the inventory.
  if (inventory) {
    // "Splunk" is covered by "Splunk Enterprise (SIEM)" and the reverse, but only as whole words ("Go" isn't in "Google").
    // Certifications count as known here; whether they're earned is the certification rule's job.
    const names = [
      ...inventory.tools.map((tool) => tool.name),
      ...inventory.certifications.map((cert) => cert.name),
      ...(inventory.coursework ?? []).flatMap((course) => [...course.tools, ...course.topics]),
    ]
    const inInventory = (term: string) => names.some((name) => termPattern(term, 'i').test(name) || termPattern(name, 'i').test(term))
    for (const { path, text } of everything) {
      for (const { term, pattern } of vocabulary) {
        if (CERTIFICATIONS.some((cert) => termPattern(cert, 'i').test(term))) continue
        if (pattern.test(text) && !inInventory(term)) add('red', 'tool_not_in_inventory', path, `"${term}" isn't in the experience inventory.`, text)
      }
    }
  } else {
    add('yellow', 'no_inventory', '*', 'No experience inventory uploaded yet, so tools and certifications were checked against the base resumes only.')
  }

  // Red: a term only coursework backs, in a cover letter or answer that doesn't say it's coursework (or, for a course
  // still in progress, that he's taking it now). Validation already keeps coursework out of bullets and the summary.
  const coursework = inventory?.coursework ?? []
  if (coursework.length) {
    const fullBase = allBaseText(base)
    for (const { path, text } of prose.filter((item) => item.path !== 'summary')) {
      for (const { term, pattern } of vocabulary) {
        if (!pattern.test(text) || pattern.test(fullBase)) continue
        const courses = coursework.filter((course) => pattern.test(courseText(course)))
        if (!courses.length) continue
        const label = `${courses[0].title} (${courses[0].code})`
        if (!COURSE_WORDS.test(text)) add('red', 'coursework_framing', path, `"${term}" comes only from coursework; say so, e.g. "in my ${label} course".`, text)
        else if (courses.every((course) => course.status === 'in_progress') && !CURRENT_WORDS.test(text)) {
          add('red', 'coursework_framing', path, `"${term}" comes from ${label}, which is still in progress; say you're taking it now.`, text)
        }
      }
    }
  }

  // Red: certifications that aren't earned.
  for (const { path, text } of everything) {
    for (const cert of CERTIFICATIONS) {
      if (!termPattern(cert).test(text)) continue
      const held = inventory?.certifications.find((entry) => entry.name.toLowerCase().includes(cert.toLowerCase()))
      if (held?.status === 'earned') continue
      if (held?.status === 'in_progress' && PROGRESS_WORDS.test(text)) continue
      add('red', 'certification', path, held ? `${cert} is in progress; say so ("expected", "in progress").` : `${cert} isn't an earned certification in the inventory.`, text)
    }
  }

  // Red: contact, titles, employers, dates or education differ from the base (they're copied, so this means drift).
  const expected = resolveResume(packet, base)
  const locked = (r: ResolvedResume) => JSON.stringify([r.contact, r.education, r.coursework, r.certifications, [...r.experience, ...r.projects].map((e) => [e.heading, e.subheading, e.right])])
  if (locked(expected) !== locked(resume)) add('red', 'locked_fields', '*', 'Contact details, titles, employers, dates, education or certifications differ from the base resumes.')

  // Yellow: wording that reads like generated text.
  for (const { path, text } of everything) {
    for (const word of BUZZWORDS) if (termPattern(word, 'i').test(text)) add('yellow', 'buzzword', path, `"${word}" reads as filler; say what was done instead.`, text)
    for (const word of VAGUE) if (termPattern(word, 'i').test(text)) add('yellow', 'vague', path, `"${word}" is vague; name the specifics.`, text)
  }
  const dashes = everything.reduce((sum, { text }) => sum + (text.match(/—/g) ?? []).length, 0)
  if (dashes > 2) add('yellow', 'em_dashes', '*', `${dashes} em dashes; real writing rarely has this many.`)
  const verbCounts = new Map<string, number>()
  for (const bullet of bullets) verbCounts.set(leadVerb(bullet.text), (verbCounts.get(leadVerb(bullet.text)) ?? 0) + 1)
  for (const [verb, count] of verbCounts) if (verb && count >= 3) add('yellow', 'repetitive', '*', `${count} bullets start with "${verb}"; vary how they open.`)
  for (const bullet of bullets) {
    if (bullet.source && retention(bullet.text, bullet.source) < 0.5) add('yellow', 'reworded', bullet.path, 'Reworded heavily; keeps less than half of the original wording.', bullet.text)
  }
  const baseLeadership = new Set((baseText.match(LEADERSHIP_WORDS) ?? []).map((word) => word.toLowerCase()))
  for (const { path, text } of prose) {
    for (const word of new Set((text.match(LEADERSHIP_WORDS) ?? []).map((w) => w.toLowerCase()))) {
      if (!baseLeadership.has(word)) add('yellow', 'leadership_claim', path, `Says "${word}", which no base bullet does.`, text)
    }
  }

  // Yellow, read-aloud pass: run-on sentences, stuffed keywords and stiff resume-speak.
  for (const { path, text } of everything) {
    const words = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.split(/\s+/).filter(Boolean).length)
    if (Math.max(0, ...words) > LONG_SENTENCE_WORDS) add('yellow', 'long_sentence', path, `One sentence runs ${Math.max(...words)} words; split it so it reads aloud in one breath.`, text)
    // A tool named twice in a bullet or the summary (three times in a paragraph) reads as keyword stuffing.
    const most = path.startsWith('cover_letter') || path.startsWith('answers') ? 3 : 2
    for (const { term } of vocabulary) {
      const count = (text.match(termPattern(term, 'g')) ?? []).length
      if (count >= most) add('yellow', 'keyword_repeat', path, `"${term}" appears ${count} times in one line; once reads more naturally.`, text)
    }
    if (expansionsIn(text).length >= 2) add('yellow', 'stacked_expansions', path, 'Two or more spelled-out acronyms in one line are hard to read; keep the one that matters most.', text)
  }
  for (const bullet of bullets) {
    if (DUTY_OPENERS.test(bullet.text.trim())) add('yellow', 'duty_phrase', bullet.path, 'Opens with a duty ("Responsible for…"); start with what you did.', bullet.text)
    if (PASSIVE.test(bullet.text)) add('yellow', 'passive', bullet.path, 'Passive voice ("was configured"); say who did it, starting with the verb.', bullet.text)
  }
  // The same spelled-out acronym in more than one line: once is enough for an ATS.
  const expansions = new Map<string, number>()
  for (const { text } of everything) for (const acronym of expansionsIn(text)) expansions.set(acronym, (expansions.get(acronym) ?? 0) + 1)
  for (const [acronym, count] of expansions) if (count > 1) add('yellow', 'repeated_expansion', '*', `${acronym} is spelled out in ${count} places; spell it out once and use the short form after.`)

  // ATS estimate: posting keywords covered by the tailored resume, next to the full base version.
  const terms = vocabulary.map((entry) => entry.term)
  const { required, preferred } = postingKeywords(job.job_description ?? '', terms)
  const tailored = atsScore(required, preferred, resumeText(resume))
  const baseVersion = base.versions[packet.resume_version]
  const baseFull = [baseVersion.summary, ...[...baseVersion.experience, ...baseVersion.projects].flatMap((entry) => entry.bullets.map((b) => b.text)), ...baseVersion.skills.flatMap((g) => g.items)].join('\n')
  const ats: Ats = {
    score: tailored.score,
    base_score: atsScore(required, preferred, baseFull).score,
    required: { covered: tailored.req, missing: required.filter((term) => !tailored.req.includes(term)) },
    preferred: { covered: tailored.pref, missing: preferred.filter((term) => !tailored.pref.includes(term)) },
  }

  const comparisons: Comparison[] = bullets.map((bullet) => ({ path: bullet.path, source: bullet.source, text: bullet.text, diff: wordDiff(bullet.source, bullet.text) }))
  const status: CheckStatus = flags.some((flag) => flag.severity === 'red') ? 'blocked' : flags.length > 0 ? 'needs_edits' : 'pass'
  return { status, flags, comparisons, ats }
}
