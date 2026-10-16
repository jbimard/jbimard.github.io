// Application packet schema: what the Claude preparation routine sends for each approved job, checked against the
// private base resumes before anything is rendered or stored. Tailoring may only reword and reorder real experience,
// so the checks here are mechanical: every bullet points at the base bullet it rewords, numbers and tools can't appear
// out of nowhere, and contact details, titles, employers, dates and education are copied from the base, never sent.
// supabase/functions/_shared/packet.ts must stay an exact copy of this file (packet.test.ts checks).
// No imports, so the same file runs under Node and Deno.

export const RESUME_VERSIONS = ['Cloud', 'Security', 'Cloud Security'] as const
// Where an entry's locked fields come from when several base resumes have it: the chosen version first, then newest.
const VERSION_PREFERENCE = ['Cloud Security', 'Cloud', 'Security'] as const
export const ANSWER_KEYS = ['why_company', 'why_role', 'relevant_project', 'anything_else'] as const
export const ANSWER_QUESTIONS: Record<(typeof ANSWER_KEYS)[number], string> = {
  why_company: 'Why do you want to work at this company?',
  why_role: 'Why are you interested in this role?',
  relevant_project: 'Describe a project or experience most relevant to this role.',
  anything_else: 'Is there anything else you would like us to know?',
}

export const LIMITS = {
  // About three lines on the one-page resume.
  summary: 360,
  bullet: 300,
  bulletsPerEntry: 6,
  experience: 4,
  projects: 3,
  coursework: 6,
  coverLetter: 2500,
  coverLetterParagraphs: [3, 5],
  answer: 1200,
  listItems: 30,
  listItem: 60,
  gaps: 20,
  gapNote: 200,
  qualifications: 25,
  qualification: 300,
  postingText: 20000,
} as const

export type ResumeVersion = (typeof RESUME_VERSIONS)[number]
export type Bullet = { id: string; text: string }
export type BaseEntry = {
  id: string
  // Experience entries.
  org?: string
  location?: string
  title?: string
  dates?: string
  // Project entries.
  name?: string
  context?: string | null
  bullets: Bullet[]
}
export type BaseEducation = { school: string; location: string; degrees: Array<{ degree: string; date: string }> }
export type BaseSkillGroup = { id: string; label: string; items: string[] }
export type BaseVersion = {
  summary: string
  education: BaseEducation[]
  experience: BaseEntry[]
  projects: BaseEntry[]
  skills: BaseSkillGroup[]
}
export type BaseResumes = {
  // `relocation` (optional) sits next to the location on the contact line, e.g. "Open to relocation".
  contact: { name: string; location: string; relocation?: string; email: string; phone: string; links: string[] }
  // Fixed, truthful answers he wrote himself; copied into every packet as-is, never written by AI.
  workAuthorization: Array<{ question: string; answer: string }>
  versions: Record<ResumeVersion, BaseVersion>
  // Step 3c: everything he can honestly claim, with how deeply. Optional so older uploads stay valid.
  inventory?: Inventory
}

export const TOOL_DEPTHS = ['used', 'built', 'led'] as const
export const CERT_STATUSES = ['earned', 'in_progress'] as const
export const COURSE_STATUSES = ['completed', 'in_progress'] as const
// A course he took. Cover letters and answers may cite it as coursework, never as job experience; resume bullets,
// the summary and skills can't use it. `tools` are what he used hands-on, `topics` what the course covered.
export type Course = { code: string; title: string; term: string; status: (typeof COURSE_STATUSES)[number]; topics: string[]; tools: string[] }
export type Inventory = {
  tools: Array<{ name: string; depth: (typeof TOOL_DEPTHS)[number]; evidence: string }>
  certifications: Array<{ name: string; status: (typeof CERT_STATUSES)[number]; date: string | null }>
  coursework?: Course[]
  // Tools he doesn't have yet, so Fit & Gap can call them gaps. Never claimed anywhere; `note` says where he stands
  // ("never used", "learning it in ITIS 5261").
  not_yet?: Array<{ name: string; note: string }>
}

export type PacketEntry = { id: string; bullets: Array<{ from: string; text: string }> }
// Where a qualification is shown: a bullet id from this packet, or a whole resume section.
export const EVIDENCE_SECTIONS = ['summary', 'education', 'coursework', 'skills', 'certifications'] as const
export const QUALIFICATION_KINDS = ['basic', 'preferred'] as const
// One qualification from the posting, judged against this resume the way per-qualification graders (Workday
// HiredScore's Fit & Gap) do. `met` is Claude's reading, so it must cite where the resume shows it.
export type Qualification = { text: string; kind: (typeof QUALIFICATION_KINDS)[number]; met: boolean; evidence: string[]; note: string }
export type Packet = {
  job_id: string
  resume_version: ResumeVersion
  summary: { text: string }
  experience: PacketEntry[]
  projects: PacketEntry[]
  skills: Array<{ id: string; items: string[] }>
  // Course codes from inventory.coursework for the "Relevant Coursework" line. Optional so older packets stay valid.
  coursework?: string[]
  cover_letter: { paragraphs: string[] }
  answers: Record<(typeof ANSWER_KEYS)[number], string>
  // The posting's qualifications, each met or not. Optional so older packets stay valid.
  qualifications?: Qualification[]
  // The posting text the routine read, when the job has no saved description: the ATS estimate scores against it
  // and job-prep saves it on the job. Not kept in the stored packet.
  posting_text?: string
  match_report: {
    coverage: number
    covered: string[]
    gaps: Array<{ keyword: string; addable: boolean; note: string }>
  }
}
export type Warning = { path: string; message: string }

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------- base file ----------

export const validateBase = (input: unknown): { base: BaseResumes | null; errors: string[] } => {
  const errors: string[] = []
  if (!isObj(input)) return { base: null, errors: ['base must be an object.'] }
  const contact = input.contact
  if (!isObj(contact) || !['name', 'location', 'email', 'phone'].every((key) => isText(contact[key])) || !Array.isArray(contact.links)) {
    errors.push('contact needs name, location, email, phone and links[].')
  }
  if (isObj(contact) && contact.relocation !== undefined && !isText(contact.relocation)) errors.push('contact.relocation must be a non-empty string when set.')
  if (!Array.isArray(input.workAuthorization) || input.workAuthorization.some((pair) => !isObj(pair) || !isText(pair.question) || !isText(pair.answer))) {
    errors.push('workAuthorization must be an array of { question, answer }.')
  }
  const bulletIds = new Set<string>()
  if (!isObj(input.versions)) {
    errors.push('versions must be an object.')
  } else {
    for (const version of RESUME_VERSIONS) {
      const doc = input.versions[version]
      if (!isObj(doc)) {
        errors.push(`versions["${version}"] is missing.`)
        continue
      }
      if (!isText(doc.summary)) errors.push(`${version}: summary is missing.`)
      if (!Array.isArray(doc.education) || doc.education.length === 0) errors.push(`${version}: education is missing.`)
      if (!Array.isArray(doc.skills) || doc.skills.some((group) => !isObj(group) || !isText(group.id) || !isText(group.label) || !Array.isArray(group.items))) {
        errors.push(`${version}: skills must be [{ id, label, items }].`)
      }
      for (const kind of ['experience', 'projects'] as const) {
        const entries = doc[kind]
        if (!Array.isArray(entries)) {
          errors.push(`${version}: ${kind} must be an array.`)
          continue
        }
        const ids = new Set<string>()
        for (const entry of entries) {
          if (!isObj(entry) || !isText(entry.id) || !Array.isArray(entry.bullets)) {
            errors.push(`${version}: every ${kind} entry needs an id and bullets.`)
            continue
          }
          if (ids.has(entry.id)) errors.push(`${version}: duplicate ${kind} id "${entry.id}".`)
          ids.add(entry.id)
          if (kind === 'experience' && !['org', 'title', 'dates'].every((key) => isText(entry[key]))) {
            errors.push(`${version}: experience "${entry.id}" needs org, title and dates.`)
          }
          if (kind === 'projects' && !isText(entry.name)) errors.push(`${version}: project "${entry.id}" needs a name.`)
          for (const bullet of entry.bullets) {
            if (!isObj(bullet) || !isText(bullet.id) || !isText(bullet.text)) errors.push(`${version}: "${entry.id}" has a bullet without id/text.`)
            else if (bulletIds.has(bullet.id)) errors.push(`duplicate bullet id "${bullet.id}".`)
            else bulletIds.add(bullet.id)
          }
        }
      }
    }
  }
  if (input.inventory !== undefined) {
    const inventory = input.inventory
    if (!isObj(inventory) || !Array.isArray(inventory.tools) || !Array.isArray(inventory.certifications)) {
      errors.push('inventory must be { tools: [...], certifications: [...] }.')
    } else {
      inventory.tools.forEach((tool, i) => {
        if (!isObj(tool) || !isText(tool.name) || !TOOL_DEPTHS.includes(tool.depth as never) || typeof tool.evidence !== 'string') {
          errors.push(`inventory.tools[${i}] must be { name, depth: ${TOOL_DEPTHS.join('|')}, evidence }.`)
        }
      })
      inventory.certifications.forEach((cert, i) => {
        if (!isObj(cert) || !isText(cert.name) || !CERT_STATUSES.includes(cert.status as never) || (cert.date !== null && typeof cert.date !== 'string')) {
          errors.push(`inventory.certifications[${i}] must be { name, status: ${CERT_STATUSES.join('|')}, date }.`)
        }
      })
      const coursework = inventory.coursework
      if (coursework !== undefined && !Array.isArray(coursework)) errors.push('inventory.coursework must be an array.')
      else coursework?.forEach((course, i) => {
        const textList = (value: unknown) => Array.isArray(value) && value.every(isText)
        if (!isObj(course) || !['code', 'title', 'term'].every((key) => isText(course[key])) || !COURSE_STATUSES.includes(course.status as never) || !textList(course.topics) || !textList(course.tools)) {
          errors.push(`inventory.coursework[${i}] must be { code, title, term, status: ${COURSE_STATUSES.join('|')}, topics: [...], tools: [...] }.`)
        }
      })
      const notYet = inventory.not_yet
      if (notYet !== undefined && !Array.isArray(notYet)) errors.push('inventory.not_yet must be an array.')
      else {
        const claimed = new Set(inventory.tools.filter(isObj).map((tool) => String(tool.name).toLowerCase()))
        notYet?.forEach((gap, i) => {
          if (!isObj(gap) || !isText(gap.name) || typeof gap.note !== 'string') errors.push(`inventory.not_yet[${i}] must be { name, note }.`)
          else if (claimed.has(gap.name.toLowerCase())) errors.push(`inventory.not_yet[${i}]: ${gap.name} is also in inventory.tools.`)
        })
      }
    }
  }
  return { base: errors.length === 0 ? (input as BaseResumes) : null, errors }
}

// ---------- truth checks ----------

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Tools, platforms and certifications a posting may ask for. Includes automation/config/profile.json `skills`
// (packet.test.ts checks). A tailored line may name one only if its source in the base does.
export const TECH_TERMS = [
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Kubernetes', 'Docker', 'Helm', 'Terraform', 'CloudFormation', 'Pulumi', 'Ansible',
  'Chef', 'Puppet', 'Linux', 'Windows Server', 'Python', 'Go', 'Golang', 'Java', 'JavaScript', 'TypeScript', 'Rust', 'Ruby',
  'C++', 'C#', 'Scala', 'Bash', 'PowerShell', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Kafka', 'Spark',
  'Airflow', 'Snowflake', 'Databricks', 'Splunk', 'SIEM', 'SOAR', 'EDR', 'XDR', 'IAM', 'Okta', 'Ping Identity', 'CyberArk',
  'SailPoint', 'Zero Trust', 'NIST', 'ISO 27001', 'SOC 2', 'PCI DSS', 'HIPAA', 'FedRAMP', 'CIS Benchmarks', 'Wireshark',
  'Nessus', 'Tenable', 'Qualys', 'Rapid7', 'Burp Suite', 'Metasploit', 'Nmap', 'CrowdStrike', 'SentinelOne', 'Microsoft Sentinel',
  'Defender', 'Palo Alto', 'Fortinet', 'Zscaler', 'Cloudflare', 'Wiz', 'Prisma Cloud', 'Lacework', 'Snyk', 'Vault', 'HashiCorp',
  'CI/CD', 'GitHub Actions', 'GitLab', 'Jenkins', 'Argo CD', 'Datadog', 'Prometheus', 'Grafana', 'Elastic', 'ELK', 'OpenTelemetry',
  'Lambda', 'EC2', 'S3', 'EKS', 'AKS', 'GKE', 'ServiceNow', 'Jira', 'Networking', 'TCP/IP', 'DNS', 'Firewall', 'VPN',
  'Incident Response', 'Threat Modeling', 'Vulnerability Management', 'Penetration Testing', 'Digital Forensics',
  'Security+', 'CySA+', 'CISSP', 'CEH', 'OSCP', 'CCNA', 'AZ-900', 'AZ-104', 'AZ-500', 'SC-200', 'SC-300', 'AWS Certified',
  'Security Clearance',
]

// Known terms: TECH_TERMS, the job's required skills, and every base skill item. Matching is case-sensitive, so
// ordinary words ("go", "spark", "elastic") don't count as the product names.
export const buildVocabulary = (base: BaseResumes, jobSkills: string[] = []) => {
  const terms = new Set<string>([...TECH_TERMS, ...jobSkills.map((skill) => skill.trim())])
  for (const version of RESUME_VERSIONS) for (const group of base.versions[version].skills) for (const item of group.items) terms.add(item)
  return [...terms].filter((term) => term.trim().length >= 2).map((term) => ({
    term,
    pattern: new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term.trim())}(?![A-Za-z0-9])`),
  }))
}
type Vocabulary = ReturnType<typeof buildVocabulary>

// jobs.required_skills is a comma-separated list from discovery.
export const splitSkills = (value: string | null) => (value ?? '').split(/[,;]/).map((skill) => skill.trim()).filter(Boolean)

// Numbers written as words count too ("six platforms" vs "4"). "one" is left out: it's usually a pronoun.
const UNITS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ONES_AFTER_TENS: Record<string, number> = { one: 1, ...Object.fromEntries(Object.entries(UNITS).filter(([, n]) => n < 10)) }

export const numbersIn = (text: string) => {
  const found = new Set(text.match(/\d+(?:\.\d+)?/g) ?? [])
  for (const match of text.toLowerCase().matchAll(/\b([a-z]+)(?:-([a-z]+))?\b/g)) {
    const [, first, second] = match
    if (TENS[first] !== undefined) found.add(String(TENS[first] + (second ? ONES_AFTER_TENS[second] ?? 0 : 0)))
    else if (UNITS[first] !== undefined) found.add(String(UNITS[first]))
    else if (first === 'hundred') found.add('100')
  }
  return found
}
const termsIn = (text: string, vocabulary: Vocabulary) => vocabulary.filter(({ pattern }) => pattern.test(text)).map(({ term }) => term)

// Problems with `text` given what its source says: numbers or known tools the source never mentions.
const unsupported = (text: string, source: string, vocabulary: Vocabulary) => {
  const sourceNumbers = numbersIn(source)
  const numbers = [...numbersIn(text)].filter((number) => !sourceNumbers.has(number))
  const sourceTerms = new Set(termsIn(source, vocabulary).map((term) => term.toLowerCase()))
  const terms = termsIn(text, vocabulary).filter((term) => !sourceTerms.has(term.toLowerCase()))
  return [
    ...(numbers.length ? [`numbers not in the source: ${numbers.join(', ')}`] : []),
    ...(terms.length ? [`tools/skills not in the source: ${terms.join(', ')}`] : []),
  ]
}

const contentWords = (text: string) => new Set((text.toLowerCase().match(/[a-z][a-z0-9+#./-]{3,}/g) ?? []))

// Share of the source bullet's words the tailored bullet keeps (an early form of the 3c voice check).
export const retention = (text: string, source: string) => {
  const sourceWords = contentWords(source)
  if (sourceWords.size === 0) return 1
  const kept = contentWords(text)
  return [...sourceWords].filter((word) => kept.has(word)).length / sourceWords.size
}

export const allBaseText = (base: BaseResumes) => RESUME_VERSIONS.map((version) => {
  const doc = base.versions[version]
  return [
    doc.summary,
    ...doc.education.flatMap((school) => [school.school, ...school.degrees.flatMap((degree) => [degree.degree, degree.date])]),
    ...[...doc.experience, ...doc.projects].flatMap((entry) => [entry.org, entry.title, entry.dates, entry.name, ...entry.bullets.map((bullet) => bullet.text)]),
    ...doc.skills.flatMap((group) => group.items),
  ].filter(Boolean).join('\n')
}).join('\n')

export const courseText = (course: Course) => [course.code, course.title, ...course.topics, ...course.tools].join('\n')
const courseworkText = (base: BaseResumes) => (base.inventory?.coursework ?? []).map(courseText).join('\n')

// Entry by id from the chosen version first, then the newest base that has it.
const findEntry = (base: BaseResumes, kind: 'experience' | 'projects', id: string, chosen: ResumeVersion) => {
  for (const version of [chosen, ...VERSION_PREFERENCE.filter((other) => other !== chosen)]) {
    const entry = base.versions[version][kind].find((candidate) => candidate.id === id)
    if (entry) return entry
  }
  return null
}

// Every base bullet of an entry id, across versions: a bullet may reword any version's wording of the same job.
const bulletsFor = (base: BaseResumes, kind: 'experience' | 'projects', id: string) => new Map(
  RESUME_VERSIONS.flatMap((version) => base.versions[version][kind].filter((entry) => entry.id === id).flatMap((entry) => entry.bullets))
    .map((bullet) => [bullet.id, bullet.text]),
)

export const validatePacket = (
  input: unknown,
  base: BaseResumes,
  vocabulary: Vocabulary,
): { packet: Packet | null; errors: string[]; warnings: Warning[] } => {
  const errors: string[] = []
  const warnings: Warning[] = []
  if (!isObj(input)) return { packet: null, errors: ['packet must be an object.'], warnings }

  const text = (path: string, value: unknown, limit: number, allowEmpty = false) => {
    if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) errors.push(`${path} must be a non-empty string.`)
    else if (value.length > limit) errors.push(`${path} must be at most ${limit} characters.`)
    return typeof value === 'string' ? value : ''
  }
  const stringList = (path: string, value: unknown) => {
    if (!Array.isArray(value) || value.length > LIMITS.listItems) errors.push(`${path} must be an array of at most ${LIMITS.listItems} strings.`)
    else value.forEach((item, i) => text(`${path}[${i}]`, item, LIMITS.listItem))
  }
  const everything = allBaseText(base)
  // The cover letter and answers may also cite coursework; the Resume check makes sure they say it's coursework.
  const everythingAndCoursework = `${everything}\n${courseworkText(base)}`

  if (typeof input.job_id !== 'string' || !UUID.test(input.job_id)) errors.push('job_id must be a job UUID.')
  const version = input.resume_version as ResumeVersion
  if (!RESUME_VERSIONS.includes(version)) {
    errors.push(`resume_version must be one of: ${RESUME_VERSIONS.join(', ')}.`)
    return { packet: null, errors, warnings }
  }

  // Summary: may draw on anything in the base, but adds no numbers or tools of its own.
  const summary = isObj(input.summary) ? text('summary.text', input.summary.text, LIMITS.summary) : (errors.push('summary must be { text }.'), '')
  for (const problem of unsupported(summary, everything, vocabulary)) errors.push(`summary: ${problem}.`)

  for (const kind of ['experience', 'projects'] as const) {
    const entries = input[kind]
    const max = kind === 'experience' ? LIMITS.experience : LIMITS.projects
    if (!Array.isArray(entries) || entries.length > max || (kind === 'experience' && entries.length === 0)) {
      errors.push(`${kind} must be an array of 1–${max} entries.`)
      continue
    }
    const seen = new Set<string>()
    entries.forEach((entry, i) => {
      const path = `${kind}[${i}]`
      if (!isObj(entry) || typeof entry.id !== 'string' || !Array.isArray(entry.bullets)) {
        errors.push(`${path} must be { id, bullets }.`)
        return
      }
      if (seen.has(entry.id)) errors.push(`${path}: "${entry.id}" is listed twice.`)
      seen.add(entry.id)
      if (!findEntry(base, kind, entry.id, version)) {
        errors.push(`${path}: unknown ${kind} id "${entry.id}".`)
        return
      }
      const sources = bulletsFor(base, kind, entry.id)
      if (entry.bullets.length === 0 || entry.bullets.length > LIMITS.bulletsPerEntry) errors.push(`${path}.bullets must have 1–${LIMITS.bulletsPerEntry} items.`)
      entry.bullets.forEach((bullet, j) => {
        const bulletPath = `${path}.bullets[${j}]`
        if (!isObj(bullet)) {
          errors.push(`${bulletPath} must be { from, text }.`)
          return
        }
        const source = typeof bullet.from === 'string' ? sources.get(bullet.from) : undefined
        const value = text(`${bulletPath}.text`, bullet.text, LIMITS.bullet)
        if (source === undefined) {
          errors.push(`${bulletPath}.from must be a base bullet id of "${entry.id}".`)
          return
        }
        for (const problem of unsupported(value, source, vocabulary)) errors.push(`${bulletPath}: ${problem}.`)
        if (value && retention(value, source) < 0.5) warnings.push({ path: bulletPath, message: 'Reworded heavily; keeps less than half of the original wording.' })
      })
    })
  }

  // Skills: only items that already exist in a base skill list.
  const baseItems = new Set(RESUME_VERSIONS.flatMap((v) => base.versions[v].skills.flatMap((group) => group.items.map((item) => item.toLowerCase()))))
  const groupIds = new Set(RESUME_VERSIONS.flatMap((v) => base.versions[v].skills.map((group) => group.id)))
  if (!Array.isArray(input.skills) || input.skills.length === 0 || input.skills.length > 5) {
    errors.push('skills must be an array of 1–5 groups.')
  } else {
    input.skills.forEach((group, i) => {
      if (!isObj(group) || typeof group.id !== 'string' || !groupIds.has(group.id) || !Array.isArray(group.items)) {
        errors.push(`skills[${i}] must be { id: <base skill group id>, items }.`)
        return
      }
      const extra = group.items.filter((item) => typeof item !== 'string' || !baseItems.has(item.toLowerCase()))
      if (extra.length) errors.push(`skills[${i}]: not in the base skills: ${extra.map(String).join(', ')}.`)
    })
  }

  // Relevant coursework: codes from the inventory, each once. Titles come from the base, never from the packet.
  if (input.coursework !== undefined) {
    const known = new Set((base.inventory?.coursework ?? []).map((course) => course.code))
    const codes = input.coursework
    if (!Array.isArray(codes) || codes.length > LIMITS.coursework) {
      errors.push(`coursework must be an array of at most ${LIMITS.coursework} course codes.`)
    } else {
      const extra = codes.filter((code) => typeof code !== 'string' || !known.has(code))
      if (extra.length) errors.push(`coursework: not in inventory.coursework: ${extra.map(String).join(', ')}.`)
      if (new Set(codes).size !== codes.length) errors.push('coursework lists a course twice.')
    }
  }

  // Cover letter and answers: anything they name must exist somewhere in the base or the coursework.
  if (!isObj(input.cover_letter) || !Array.isArray(input.cover_letter.paragraphs)) {
    errors.push('cover_letter must be { paragraphs: [...] }.')
  } else {
    const paragraphs = input.cover_letter.paragraphs
    const [min, max] = LIMITS.coverLetterParagraphs
    if (paragraphs.length < min || paragraphs.length > max) errors.push(`cover_letter.paragraphs must have ${min}–${max} items.`)
    paragraphs.forEach((paragraph, i) => text(`cover_letter.paragraphs[${i}]`, paragraph, LIMITS.coverLetter))
    const letter = paragraphs.filter((p): p is string => typeof p === 'string').join('\n\n')
    if (letter.length > LIMITS.coverLetter) errors.push(`cover_letter must be at most ${LIMITS.coverLetter} characters in total.`)
    for (const problem of unsupported(letter, everythingAndCoursework, vocabulary)) errors.push(`cover_letter: ${problem}.`)
  }
  if (!isObj(input.answers)) {
    errors.push('answers must be an object.')
  } else {
    for (const key of ANSWER_KEYS) {
      const value = text(`answers.${key}`, input.answers[key], LIMITS.answer, key === 'anything_else')
      for (const problem of unsupported(value, everythingAndCoursework, vocabulary)) errors.push(`answers.${key}: ${problem}.`)
    }
  }

  const report = input.match_report
  if (!isObj(report)) {
    errors.push('match_report must be an object.')
  } else {
    if (!Number.isInteger(report.coverage) || (report.coverage as number) < 0 || (report.coverage as number) > 100) errors.push('match_report.coverage must be an integer from 0 to 100.')
    stringList('match_report.covered', report.covered)
    if (!Array.isArray(report.gaps) || report.gaps.length > LIMITS.gaps) {
      errors.push(`match_report.gaps must be an array of at most ${LIMITS.gaps} items.`)
    } else {
      report.gaps.forEach((gap, i) => {
        if (!isObj(gap) || typeof gap.addable !== 'boolean') errors.push(`match_report.gaps[${i}] must be { keyword, addable, note }.`)
        else {
          text(`match_report.gaps[${i}].keyword`, gap.keyword, LIMITS.listItem)
          text(`match_report.gaps[${i}].note`, gap.note, LIMITS.gapNote)
        }
      })
    }
  }

  // Qualifications: a "met" one must point at a bullet in this packet or at a section the resume has.
  if (input.qualifications !== undefined) {
    const list = input.qualifications
    const bulletIds = new Set((['experience', 'projects'] as const).flatMap((kind) => (Array.isArray(input[kind]) ? input[kind] as unknown[] : [])
      .flatMap((entry) => (isObj(entry) && Array.isArray(entry.bullets) ? entry.bullets : []))
      .flatMap((bullet) => (isObj(bullet) && typeof bullet.from === 'string' ? [bullet.from] : []))))
    const sections = new Set<string>(['summary', 'education', 'skills'])
    if (Array.isArray(input.coursework) && input.coursework.length) sections.add('coursework')
    if (earnedCertifications(base).length) sections.add('certifications')
    if (!Array.isArray(list) || list.length > LIMITS.qualifications) {
      errors.push(`qualifications must be an array of at most ${LIMITS.qualifications} items.`)
    } else {
      list.forEach((item, i) => {
        const path = `qualifications[${i}]`
        if (!isObj(item) || !QUALIFICATION_KINDS.includes(item.kind as never) || typeof item.met !== 'boolean' || !Array.isArray(item.evidence)) {
          errors.push(`${path} must be { text, kind: ${QUALIFICATION_KINDS.join('|')}, met, evidence: [...], note }.`)
          return
        }
        text(`${path}.text`, item.text, LIMITS.qualification)
        text(`${path}.note`, item.note, LIMITS.gapNote, true)
        const unknown = item.evidence.filter((ref) => typeof ref !== 'string' || (!bulletIds.has(ref) && !sections.has(ref)))
        if (unknown.length) errors.push(`${path}.evidence: not a bullet in this packet or a section the resume has: ${unknown.map(String).join(', ')}.`)
        if (item.met && item.evidence.length === 0) errors.push(`${path} is marked met but cites no evidence.`)
      })
    }
  }

  if (input.posting_text !== undefined) text('posting_text', input.posting_text, LIMITS.postingText)

  const allText = JSON.stringify([input.summary, input.experience, input.projects, input.cover_letter, input.answers])
  const dashes = (allText.match(/—/g) ?? []).length
  if (dashes > 2) warnings.push({ path: '*', message: `${dashes} em dashes; real writing rarely has this many.` })

  return { packet: errors.length === 0 ? (input as Packet) : null, errors, warnings }
}

// ---------- the resolved resume (what gets rendered and stored) ----------

// `right` is the right-aligned text on the entry's last heading line: dates for a job, "GitHub" or an employer for a project.
// `sources` lines up with `bullets`: the base bullet each one rewords (kept for the Resume check's side-by-side view).
export type ResolvedEntry = {
  heading: string
  subheading: string | null
  right: string | null
  bullets: string[]
  sources: Array<{ id: string; text: string }>
}
export type ResolvedResume = {
  contact: BaseResumes['contact']
  summary: string
  education: BaseEducation[]
  coursework: string[]
  // Earned certifications from the inventory, never from the packet.
  certifications: string[]
  experience: ResolvedEntry[]
  projects: ResolvedEntry[]
  skills: Array<{ label: string; items: string[] }>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "Mastercard Cybersecurity Job Simulation (Forage), Jan 2025": inventory dates are "YYYY", "YYYY-MM" or "YYYY-MM-DD".
export const earnedCertifications = (base: BaseResumes) => (base.inventory?.certifications ?? []).filter((cert) => cert.status === 'earned').map((cert) => {
  const [year, month] = (cert.date ?? '').split('-')
  const when = /^\d{4}$/.test(year ?? '') ? (month && MONTHS[Number(month) - 1] ? `${MONTHS[Number(month) - 1]} ${year}` : year) : ''
  return when ? `${cert.name}, ${when}` : cert.name
})

// Locked fields (contact, titles, employers, dates, education, skill labels) come from the base, never from the packet.
export const resolveResume = (packet: Packet, base: BaseResumes): ResolvedResume => {
  const version = base.versions[packet.resume_version]
  const labels = new Map(RESUME_VERSIONS.flatMap((v) => base.versions[v].skills.map((group) => [group.id, group.label] as const)))
  const courses = new Map((base.inventory?.coursework ?? []).map((course) => [course.code, course] as const))
  // Skill items are written exactly as the base spells them.
  const spelling = new Map(RESUME_VERSIONS.flatMap((v) => base.versions[v].skills.flatMap((group) => group.items.map((item) => [item.toLowerCase(), item] as const))))
  return {
    contact: base.contact,
    summary: packet.summary.text.trim(),
    education: version.education,
    coursework: (packet.coursework ?? []).flatMap((code) => {
      const course = courses.get(code)
      return course ? [`${course.title}${course.status === 'in_progress' ? ' (in progress)' : ''}`] : []
    }),
    certifications: earnedCertifications(base),
    experience: packet.experience.map((entry) => {
      const source = findEntry(base, 'experience', entry.id, packet.resume_version)!
      return {
        heading: `${source.org}${source.location ? `, ${source.location}` : ''}`,
        subheading: source.title ?? null,
        right: source.dates ?? null,
        bullets: entry.bullets.map((bullet) => bullet.text.trim()),
        sources: entry.bullets.map((bullet) => ({ id: bullet.from, text: bulletsFor(base, 'experience', entry.id).get(bullet.from) ?? '' })),
      }
    }),
    projects: packet.projects.map((entry) => {
      const source = findEntry(base, 'projects', entry.id, packet.resume_version)!
      return {
        heading: source.name!,
        subheading: null,
        right: source.context ?? null,
        bullets: entry.bullets.map((bullet) => bullet.text.trim()),
        sources: entry.bullets.map((bullet) => ({ id: bullet.from, text: bulletsFor(base, 'projects', entry.id).get(bullet.from) ?? '' })),
      }
    }),
    skills: packet.skills.map((group) => ({ label: labels.get(group.id)!, items: group.items.map((item) => spelling.get(item.toLowerCase()) ?? item) })),
  }
}
