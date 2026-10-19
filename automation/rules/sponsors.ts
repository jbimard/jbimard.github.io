// USCIS H-1B Employer Data Hub: parsing the export, matching company names, and the sponsorship label.
import type { Profile, SponsorTier } from '../types.ts'

// In memory, after fromSponsorFile.
export type SponsorData = {
  source: string
  builtAt: string
  fiscalYears: number[]
  // The fiscal year still in progress, if any; shown as "to date" and not used for the tier.
  partialYear: number | null
  // Keyed by normalizeEmployer(name). Counts are New Employment approvals per fiscal year.
  employers: Record<string, { name: string; byYear: Record<string, number> }>
}

// On disk as automation/data/h1b-sponsors.json (built by scripts/build-sponsors.ts): one
// [display name, count for each of fiscalYears] row per employer, so the file stays small and diffs by line.
export type SponsorFile = Omit<SponsorData, 'employers'> & { employers: Array<[string, ...number[]]> }

export type SponsorRecord = {
  tier: SponsorTier
  // Latest complete fiscal year in the data, and this company's count for it.
  fiscalYear: number | null
  count: number
  byYear: Record<string, number>
  matchedNames: string[]
  // Shown in sponsorship_notes, e.g. "USCIS: 212 new-employment H-1B approvals in FY2025 (FY2024: 180)."
  label: string | null
}

// Dropped from the end of a name: "Wells Fargo Bank, N.A." → "wells fargo bank".
const LEGAL_SUFFIXES = new Set(['inc', 'incorporated', 'llc', 'l l c', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'lp', 'llp', 'plc', 'na', 'n a', 'pc', 'pllc'])

// Extra words a USCIS name may carry beyond the company's own name and still be the same company.
const GENERIC_WORDS = new Set([
  'the', 'of', 'and', 'bank', 'banking', 'financial', 'finance', 'services', 'service', 'securities', 'technologies',
  'technology', 'tech', 'usa', 'us', 'america', 'americas', 'north', 'holdings', 'holding', 'group', 'international',
  'global', 'software', 'systems', 'labs', 'investments', 'investment', 'solutions', 'enterprises', 'enterprise',
  'companies', 'corporation', 'company', 'inc', 'llc', 'corp', 'operations', 'management', 'national', 'association',
  'markets', 'business', 'semiconductor', 'ai',
])

export const normalizeEmployer = (name: string) => {
  let tokens = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  // "FMR LLC D/B/A Fidelity Investments": the doing-business-as name is the one people know.
  const dba = tokens.findIndex((token, i) => token === 'dba' || (token === 'd' && tokens[i + 1] === 'b' && tokens[i + 2] === 'a'))
  if (dba !== -1) {
    const after = tokens.slice(dba + (tokens[dba] === 'dba' ? 1 : 3))
    if (after.length > 0) tokens = after
  }
  if (tokens[0] === 'the' && tokens.length > 1) tokens = tokens.slice(1)
  while (tokens.length > 1) {
    const lastTwo = tokens.slice(-2).join(' ')
    if (LEGAL_SUFFIXES.has(lastTwo) && tokens.length > 2) tokens = tokens.slice(0, -2)
    else if (LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1)
    else break
  }
  return tokens.join(' ')
}

export const toSponsorFile = (data: SponsorData): SponsorFile => ({
  ...data,
  employers: Object.values(data.employers).map(({ name, byYear }) => [name, ...data.fiscalYears.map((year) => byYear[year] ?? 0)]),
})

export const fromSponsorFile = (file: SponsorFile): SponsorData => {
  const employers: SponsorData['employers'] = {}
  for (const [name, ...counts] of file.employers) {
    const byYear: Record<string, number> = {}
    file.fiscalYears.forEach((year, i) => { if (counts[i]) byYear[year] = counts[i] })
    employers[normalizeEmployer(name)] = { name, byYear }
  }
  return { ...file, employers }
}

// Pretty enough to diff: the header fields, then one employer per line.
export const serializeSponsorFile = (file: SponsorFile) => {
  const { employers, ...header } = file
  const head = JSON.stringify(header, null, 2).replace(/\n}$/, ',\n  "employers": [\n')
  return `${head}${employers.map((row) => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]\n}\n`
}

export type SponsorIndex = { data: SponsorData; byFirstToken: Map<string, string[]> }

export const indexSponsors = (data: SponsorData): SponsorIndex => {
  const byFirstToken = new Map<string, string[]>()
  for (const key of Object.keys(data.employers)) {
    const first = key.split(' ')[0]
    const list = byFirstToken.get(first)
    if (list) list.push(key)
    else byFirstToken.set(first, [key])
  }
  return { data, byFirstToken }
}

export const latestCompleteYear = (data: SponsorData) => {
  const complete = data.fiscalYears.filter((year) => year !== data.partialYear)
  return complete.length > 0 ? Math.max(...complete) : null
}

export const tierOf = (count: number, thresholds: Profile['sponsorTiers']): SponsorTier => {
  if (count >= thresholds.strong) return 'strong'
  if (count >= thresholds.some) return 'some'
  if (count >= 1) return 'rare'
  return 'none'
}

// Exact normalized match, else USCIS names that start with the company's name and only add generic words.
const matchKeys = (index: SponsorIndex, name: string) => {
  const wanted = normalizeEmployer(name)
  if (!wanted) return []
  // An exact hit still sums the loose matches: "Wells Fargo" and "Wells Fargo Bank" are the same employer.
  const candidates = index.byFirstToken.get(wanted.split(' ')[0]) ?? []
  return candidates.filter((key) => {
    if (key === wanted) return true
    if (!key.startsWith(`${wanted} `)) return false
    return key.slice(wanted.length + 1).split(' ').every((token) => GENERIC_WORDS.has(token))
  })
}

const plural = (count: number) => `${count.toLocaleString('en-US')} new-employment H-1B approval${count === 1 ? '' : 's'}`

type LabelInput = { fiscalYear: number | null; count: number; byYear: Record<string, number>; matched: boolean }

const sponsorLabel = (record: LabelInput, company: string, data: SponsorData) => {
  if (record.fiscalYear === null) return null
  const complete = data.fiscalYears.filter((year) => year !== data.partialYear)
  if (!record.matched) {
    const range = complete.length > 1 ? `FY${Math.min(...complete)}–FY${Math.max(...complete)}` : `FY${record.fiscalYear}`
    return `USCIS: no new-employment H-1B approvals on record for "${company}" (${range}; name match may miss). Small employers often have none, and OPT/STEM OPT doesn't need it: check E-Verify.`
  }
  const others = [...data.fiscalYears]
    .filter((year) => year !== record.fiscalYear)
    .sort((a, b) => b - a)
    .map((year) => `FY${year}${year === data.partialYear ? ' to date' : ''}: ${(record.byYear[year] ?? 0).toLocaleString('en-US')}`)
  return `USCIS: ${plural(record.count)} in FY${record.fiscalYear}${others.length > 0 ? ` (${others.join('; ')})` : ''}.`
}

// `aliases` replace the company name when set (companies.json `h1bNames`), e.g. Fidelity → "FMR".
export const lookupSponsor = (
  index: SponsorIndex,
  company: string,
  thresholds: Profile['sponsorTiers'],
  aliases?: string[],
): SponsorRecord => {
  const keys = [...new Set((aliases?.length ? aliases : [company]).flatMap((name) => matchKeys(index, name)))]
  const byYear: Record<string, number> = {}
  for (const key of keys) {
    for (const [year, count] of Object.entries(index.data.employers[key].byYear)) {
      byYear[year] = (byYear[year] ?? 0) + count
    }
  }
  const fiscalYear = latestCompleteYear(index.data)
  const count = fiscalYear === null ? 0 : (byYear[fiscalYear] ?? 0)
  const matchedNames = keys.map((key) => index.data.employers[key].name)
  return {
    // No USCIS name matched at all (a small or new employer, or a name the match missed): not the same as 0 approvals.
    tier: matchedNames.length === 0 ? 'unknown' : tierOf(count, thresholds),
    fiscalYear,
    count,
    byYear,
    matchedNames,
    label: sponsorLabel({ fiscalYear, count, byYear, matched: matchedNames.length > 0 }, company, index.data),
  }
}

export const NO_SPONSOR_DATA: SponsorRecord = { tier: 'unknown', fiscalYear: null, count: 0, byYear: {}, matchedNames: [], label: null }

// --- Building the trimmed file from the hub's export ---

// Handles quotes, escaped quotes and newlines inside quotes. Tableau exports are often tab-separated.
export const parseDelimited = (text: string): string[][] => {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'))
  const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

// Raw bytes → text: Excel/Tableau exports may be UTF-16 with a BOM.
export const decodeExport = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
}

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '')

const COLUMNS = {
  fiscalYear: ['fiscalyear'],
  employer: ['employername', 'employer', 'employerpetitionername', 'petitionername'],
  newEmploymentApproval: ['newemploymentapproval', 'newemploymentapprovals'],
} as const

export type HubRow = { fiscalYear: number; employer: string; newEmploymentApproval: number }

export const readHubRows = (rows: string[][]): HubRow[] => {
  const [header, ...body] = rows
  const keys = (header ?? []).map(headerKey)
  const column = Object.fromEntries(Object.entries(COLUMNS).map(([name, aliases]) => (
    [name, keys.findIndex((key) => (aliases as readonly string[]).includes(key))]
  ))) as Record<keyof typeof COLUMNS, number>
  const missing = Object.entries(column).filter(([, index]) => index === -1).map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`Missing column(s) ${missing.join(', ')}. Headers found: ${JSON.stringify(header)}`)
  }
  const number = (value: string | undefined) => Number((value ?? '').replace(/[,\s]/g, '')) || 0
  return body
    .map((row) => ({
      fiscalYear: number(row[column.fiscalYear]),
      employer: (row[column.employer] ?? '').trim(),
      newEmploymentApproval: number(row[column.newEmploymentApproval]),
    }))
    .filter((row) => row.fiscalYear > 0 && row.employer !== '')
}

export const buildSponsorData = (rows: HubRow[], options: { source: string; partialYear: number | null; builtAt: string }): SponsorData => {
  const employers: SponsorData['employers'] = {}
  // Most common spelling per normalized name becomes the display name.
  const spellings = new Map<string, Map<string, number>>()
  const years = new Set<number>()
  for (const row of rows) {
    years.add(row.fiscalYear)
    if (row.newEmploymentApproval <= 0) continue
    const key = normalizeEmployer(row.employer)
    if (!key) continue
    const entry = (employers[key] ??= { name: row.employer, byYear: {} })
    entry.byYear[row.fiscalYear] = (entry.byYear[row.fiscalYear] ?? 0) + row.newEmploymentApproval
    const counts = spellings.get(key) ?? new Map<string, number>()
    counts.set(row.employer, (counts.get(row.employer) ?? 0) + row.newEmploymentApproval)
    spellings.set(key, counts)
  }
  for (const [key, counts] of spellings) {
    employers[key].name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }
  const sortedKeys = Object.keys(employers).sort()
  return {
    source: options.source,
    builtAt: options.builtAt,
    fiscalYears: [...years].sort((a, b) => a - b),
    partialYear: options.partialYear,
    employers: Object.fromEntries(sortedKeys.map((key) => [key, employers[key]])),
  }
}

export type SponsorCandidate = { name: string; byYear: Record<string, number>; sharedWords: number }

const totalApprovals = (byYear: Record<string, number>) => Object.values(byYear).reduce((sum, count) => sum + count, 0)

// For the screening routine's double-check: USCIS employers sharing the company's first word, ranked by
// how many of its words they share, then by total approvals (all years, so new sponsors still show).
// Claude picks the right one from the posting.
export const searchSponsors = (index: SponsorIndex, company: string, limit = 8): SponsorCandidate[] => {
  const words = normalizeEmployer(company).split(' ').filter(Boolean)
  if (words.length === 0) return []
  return (index.byFirstToken.get(words[0]) ?? [])
    .map((key) => {
      const keyWords = new Set(key.split(' '))
      const { name, byYear } = index.data.employers[key]
      return { name, byYear, sharedWords: words.filter((word) => keyWords.has(word)).length }
    })
    .sort((a, b) => (b.sharedWords - a.sharedWords) || (totalApprovals(b.byYear) - totalApprovals(a.byYear)))
    .slice(0, limit)
}
