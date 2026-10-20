import type { Profile } from '../types.ts'

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•',
}

export const decodeEntities = (text: string) => (
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
)

// Greenhouse double-escapes its HTML, so decode before and after stripping tags.
export const htmlToText = (html: string) => (
  decodeEntities(
    decodeEntities(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
)

// Don't split after abbreviations like "U.S." or "e.g." — "U.S. citizens" must stay one sentence.
const SENTENCE_BREAK = /(?<![A-Z]\.[A-Z]\.|\b(?:e\.g|i\.e|etc|inc|sr|jr|vs|no)\.)(?<=[.!?])\s+|\n+/i

export const sentences = (text: string) => (
  text.split(SENTENCE_BREAK).map((sentence) => sentence.trim()).filter(Boolean)
)

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whole-word, case-insensitive phrase match ("sr" must not match "users").
export const phraseRegex = (phrase: string) => new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase.toLowerCase())}($|[^a-z0-9])`, 'i')

export const matchesAny = (text: string, phrases: string[]) => phrases.some((phrase) => phraseRegex(phrase).test(text))

// ---------- Salary ----------

const HOURS_PER_YEAR = 2080

const toNumber = (raw: string) => {
  const cleaned = raw.replace(/[,\s$]/g, '')
  const thousands = /k$/i.test(cleaned)
  const value = parseFloat(cleaned.replace(/k$/i, ''))
  return thousands ? value * 1000 : value
}

// Midpoint of the first annual or hourly USD range in the text, as a yearly amount.
export const parseAnnualSalary = (text: string | null): number | null => {
  if (!text) return null
  // The lookahead skips company-size figures like "$100M" or "$2 billion".
  const amount = String.raw`\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?[kK]?(?!\s?(?:[mMbB]\b|million|billion))`
  const range = new RegExp(`(${amount})(?:\\s*(?:-|–|—|to)\\s*(${amount}))?(\\s*(?:\\/|per|an|a)\\s*(?:hour|hr))?`, 'g')

  for (const match of text.matchAll(range)) {
    const low = toNumber(match[1])
    const high = match[2] ? toNumber(match[2]) : low
    const midpoint = (low + high) / 2
    const hourly = Boolean(match[3]) || (midpoint >= 15 && midpoint < 200)
    const annual = hourly ? midpoint * HOURS_PER_YEAR : midpoint
    if (annual >= 30_000 && annual <= 600_000) return Math.round(annual)
  }
  return null
}

// ---------- Location ----------

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]
const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
  'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts',
  'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
  'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming',
]
// Checked first: "Hyderabad, IN" must not read as Indiana.
const NON_US = /\b(india|canada|united kingdom|uk|england|scotland|ireland|germany|france|spain|poland|netherlands|mexico|brazil|singapore|japan|australia|israel|china|hong kong|korea|philippines|argentina|colombia|costa rica|romania|portugal|sweden|switzerland|italy|czech|hungary|serbia|ukraine|turkey|uae|dubai|london|toronto|vancouver|montreal|bangalore|bengaluru|hyderabad|pune|chennai|dublin|berlin|tokyo|sydney|tel aviv|warsaw|amsterdam|emea|apac|latam)\b/i
const US_MARKERS = /\b(united states|usa|u\.s\.a?\.?|us)\b|\bamericas?\b/i
const US_STATE_CODE = new RegExp(`(,|-|\\s)\\s*(${US_STATES.join('|')})\\b`)
const US_STATE_NAME = new RegExp(`\\b(${US_STATE_NAMES.join('|')})\\b`, 'i')

export type LocationResult = {
  // Points from profile metros / remote / other US. null = not in the US at all.
  points: number | null
  metro: string | null
  remote: boolean
  // The location entry that scored best, and how many entries the posting listed.
  best: string | null
  count: number
}

// A posting can list several locations; score the best US one.
export const scoreLocation = (location: string, profile: Profile): LocationResult => {
  const parts = location.split(/;|\||\n|\s\/\s|•/).map((part) => part.trim()).filter(Boolean)
  let best: LocationResult = { points: null, metro: null, remote: false, best: null, count: parts.length }
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (NON_US.test(part) && !US_MARKERS.test(part)) continue
    const metro = Object.values(profile.metros).find((config) => matchesAny(lower, config.match))
    const isUs = Boolean(metro) || US_MARKERS.test(part) || US_STATE_CODE.test(part) || US_STATE_NAME.test(lower)
    const isRemote = /\bremote\b|anywhere/i.test(part)
    // "Remote" with no country attached is treated as US-eligible; "Remote - Canada" is not.
    const remoteUs = isRemote && (isUs || part.replace(/[^a-z]/gi, '').toLowerCase() === 'remote')

    const base = { best: part, count: parts.length }
    let candidate: LocationResult | null = null
    if (metro) candidate = { ...base, points: metro.points, metro: metro.label, remote: isRemote }
    else if (remoteUs) candidate = { ...base, points: profile.remoteUsPoints, metro: null, remote: true }
    else if (isUs && !profile.metroOnly) candidate = { ...base, points: profile.otherUsPoints, metro: null, remote: false }

    if (candidate && (best.points === null || (candidate.points ?? 0) > best.points)) best = candidate
  }
  return best
}

// Which postings to spend the per-company detail budget on first. Only metro-only profiles use it (everyone else gets 0
// and keeps their existing order): 2 = a listed metro or remote US, 1 = location not stated clearly ("2 Locations"), 0 = elsewhere.
export const locationTier = (location: string | null | undefined, profile: Profile) => {
  if (!profile.metroOnly) return 0
  const text = location ?? ''
  if (scoreLocation(text, profile).points !== null) return 2
  return !text.trim() || /\b\d+ locations?\b|multiple|various/i.test(text) ? 1 : 0
}

// "Durham, NC +9 more" — for printing; the full list still goes to /jobs.
export const shortLocation = (location: string | null, profile: Profile) => {
  if (!location) return '?'
  const { best, count } = scoreLocation(location, profile)
  const label = (best ?? location).replace(/,?\s*United States( of America)?/gi, '').trim() || location
  return count > 1 ? `${label} +${count - 1} more` : label
}

// ---------- Skills ----------

export const findSkills = (text: string, skills: string[]) => skills.filter((skill) => phraseRegex(skill).test(text))
