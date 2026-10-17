import type { IntakeJob, Profile, RawPosting } from '../types.ts'
import { detectFlags, type Flags } from './flags.ts'
import type { SponsorRecord } from './sponsors.ts'
import { findSkills, matchesAny, parseAnnualSalary, scoreLocation } from './text.ts'

export type TitleGroup = 'A' | 'B' | 'C'

const ROLE_POINTS: Record<TitleGroup, number> = { A: 30, B: 22, C: 12 }
const OFF_TARGET_ROLE_POINTS = 6
const DESCRIPTION_LIMIT = 4000
const QUOTE_LIMIT = 220

// Relevance only — decides whether a title is the kind of job we're searching for at all.
export const titleGroup = (title: string, profile: Profile): TitleGroup | null => {
  const normalized = title.toLowerCase().replace(/[–—_]/g, ' ')
  if (matchesAny(normalized, profile.excludeTitle)) return null
  for (const group of ['A', 'B', 'C'] as const) {
    if (matchesAny(normalized, profile.titleGroups[group])) return group
  }
  // Rotational / early-talent programs count only when they're tech tracks.
  if (matchesAny(normalized, profile.rotationalTitle) && matchesAny(normalized, profile.rotationalTechWords)) return 'B'
  return null
}

// Generic (group C) titles in fields outside cloud/security, e.g. "Analytics Engineer".
const isOffTarget = (title: string, group: TitleGroup, profile: Profile) => (
  group === 'C' && matchesAny(title.toLowerCase().replace(/[–—_]/g, ' '), profile.offTargetTitle)
)

export type Breakdown = { role: number; sponsor: number; level: number; location: number; pay: number; fit: number }

export type Evaluation =
  | { kind: 'irrelevant'; reason: string }
  | { kind: 'blocked'; reason: string; posting: RawPosting }
  | { kind: 'kept'; job: IntakeJob; breakdown: Breakdown; flags: Flags }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const quote = (sentence: string) => `"${sentence.length > QUOTE_LIMIT ? `${sentence.slice(0, QUOTE_LIMIT)}…` : sentence}"`

const sponsorPoints = (sponsor: SponsorRecord, flags: Flags, profile: Profile) => {
  let points = profile.sponsorPoints[sponsor.tier]
  if (flags.sponsorshipOffered || flags.eVerify) points += 5
  // No sponsorship means no H-1B path, and his truthful "now or in the future" answer usually fails the
  // application's first screen, so it costs more than any sponsor tier can make up.
  if (flags.noSponsorship) points -= 30
  if (flags.citizenship) points -= 20
  // Allowed below zero so penalties still bite for companies that start low (no USCIS record).
  return clamp(points, -30, 25)
}

const entryLevel = (flags: Flags) => flags.internship || flags.targetYear === 2027 || flags.newGradSignal

const graduationMonth = (profile: Profile) => {
  const [year, month] = profile.graduation.split('-').map(Number)
  return year * 12 + month
}

// A stated graduation window that excludes his date (Marvell's "Fall 2027 – Summer 2028"), or null. He answers the
// graduation question truthfully, so these can't get past the first screen.
const graduationMismatch = (flags: Flags, profile: Profile) => {
  const window = flags.graduationWindow
  const graduation = graduationMonth(profile)
  if (window && (graduation < window.from || graduation > window.to)) return `graduation window excludes ${profile.graduation}: ${quote(flags.graduation ?? '')}`
  return null
}

// An internship that starts after he graduates needs current enrollment, so he can't take it.
const startsAfterGraduation = (flags: Flags, profile: Profile) => (
  flags.internshipStart !== null && flags.internshipStart > graduationMonth(profile)
)

// Internships he can't take because of his May graduation: a stated window that excludes it, one that requires
// returning to school afterwards (unless it starts before his last semester), or one that starts after he graduates.
const cannotApply = (flags: Flags, profile: Profile) => {
  const mismatch = graduationMismatch(flags, profile)
  if (mismatch) return mismatch
  const lastSemester = graduationMonth(profile) - 4
  if (flags.internship && flags.returnToSchool && (flags.internshipStart === null || flags.internshipStart >= lastSemester)) {
    return `requires returning to school after the internship, which a ${profile.graduation} graduation rules out: ${quote(flags.returnToSchool)}`
  }
  if (startsAfterGraduation(flags, profile)) return `internship starts after the ${profile.graduation} graduation, so it needs current enrollment`
  return null
}

const levelPoints = (flags: Flags, mismatch: string | null) => {
  if (mismatch) return 0
  if (flags.returnToSchool) return 5
  if (flags.targetYear !== null && flags.targetYear !== 2027) return 5
  if (entryLevel(flags)) return 15
  // No entry-level signal at all usually means an experienced hire.
  return 3
}

const UNKNOWN_PAY_POINTS = 7

const payBand = (annual: number) => {
  if (annual >= 140_000) return 15
  if (annual >= 120_000) return 13
  if (annual >= 100_000) return 11
  if (annual >= 85_000) return 9
  return 5
}

const payPoints = (annual: number | null, flags: Flags) => {
  if (annual === null) return UNKNOWN_PAY_POINTS
  // High pay only helps (H-1B wage weighting) when the role is one Joseph can get;
  // on roles with no entry-level signal, a big number mostly means "senior".
  if (!entryLevel(flags)) return Math.min(UNKNOWN_PAY_POINTS, payBand(annual))
  return payBand(annual)
}

const jobTypeOf = (flags: Flags): IntakeJob['job_type'] => {
  if (flags.internship) return 'Internship'
  if (flags.rotational) return 'Rotational Program'
  if (entryLevel(flags)) return 'New Grad'
  // No level signal either way — Claude screening decides later.
  return 'Other'
}

const priorityOf = (score: number): IntakeJob['priority'] => (score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low')

const sponsorshipNotes = (sponsor: SponsorRecord, flags: Flags) => {
  const notes: string[] = []
  if (flags.citizenship) notes.push(`⚠ Citizenship stated: ${quote(flags.citizenship)}`)
  if (flags.possibleClearance) notes.push(`⚠ Clearance possibly required: ${quote(flags.possibleClearance)}`)
  if (flags.noSponsorship) notes.push(`No sponsorship (OPT/STEM OPT still applies): ${quote(flags.noSponsorship)}`)
  if (flags.sponsorshipOffered) notes.push(`Sponsorship mentioned: ${quote(flags.sponsorshipOffered)}`)
  if (sponsor.label) notes.push(sponsor.label)
  if (!flags.descriptionAvailable) notes.push('Description unavailable — clearance/citizenship not checked.')
  return notes.length > 0 ? notes.join('\n') : null
}

export const evaluatePosting = (posting: RawPosting, profile: Profile, sponsor: SponsorRecord): Evaluation => {
  const group = titleGroup(posting.title, profile)
  if (!group) return { kind: 'irrelevant', reason: 'title' }

  const location = scoreLocation(posting.location, profile)
  if (location.points === null) return { kind: 'irrelevant', reason: 'location' }

  const flags = detectFlags(posting)
  const mismatch = graduationMismatch(flags, profile)
  const blocker = cannotApply(flags, profile)
  // The one hard block: clearance roles need citizenship and can never work out.
  if (flags.clearance) return { kind: 'blocked', reason: flags.clearance, posting }
  if (flags.requiredYears !== null && flags.requiredYears > profile.maxRequiredYears) {
    return { kind: 'irrelevant', reason: 'experience' }
  }

  const annual = parseAnnualSalary(posting.salaryText) ?? parseAnnualSalary(posting.description)
  const offTarget = isOffTarget(posting.title, group, profile)
  // Title fit scales everything else, so a great sponsor or big salary can't lift an unrelated role.
  const fit = offTarget ? profile.fitWeights.offTarget : profile.fitWeights[group]
  // No new-grad/intern/2027 wording at all: usually an experienced hire, so the whole score shrinks.
  const noLevelSignal = !entryLevel(flags) && flags.targetYear === null && !flags.returnToSchool
  const levelFactor = noLevelSignal ? profile.noLevelSignalFactor : 1
  const weighted = (points: number) => Math.round(points * fit * levelFactor)
  const breakdown: Breakdown = {
    role: Math.round((offTarget ? OFF_TARGET_ROLE_POINTS : ROLE_POINTS[group]) * levelFactor),
    sponsor: weighted(sponsorPoints(sponsor, flags, profile)),
    level: weighted(levelPoints(flags, mismatch)),
    location: weighted(location.points),
    pay: weighted(payPoints(annual, flags)),
    fit,
  }
  const total = breakdown.role + breakdown.sponsor + breakdown.level + breakdown.location + breakdown.pay
  // He can't truthfully apply to these, so they stay just under the cutoff however good the rest is.
  const score = blocker ? Math.min(total, profile.minScore - 1) : total

  const description = posting.description ?? ''
  const skills = findSkills(`${posting.title}\n${description}`, profile.skills)
  const extras = [
    location.metro ? `metro=${location.metro}` : null,
    annual ? `pay≈$${Math.round(annual / 1000)}k` : null,
    blocker ? `⚠ ${blocker}` : flags.returnToSchool ? `⚠ requires returning to school: ${quote(flags.returnToSchool)}` : null,
  ].filter(Boolean)

  return {
    kind: 'kept',
    flags,
    breakdown,
    job: {
      company: posting.company,
      role_title: posting.title,
      location: posting.location || null,
      job_link: posting.url,
      status: 'Queued',
      priority: priorityOf(score),
      job_type: jobTypeOf(flags),
      work_mode: flags.workMode,
      match_score: score,
      required_skills: skills.length > 0 ? skills.join(', ') : null,
      sponsorship_notes: sponsorshipNotes(sponsor, flags),
      e_verify_notes: flags.eVerify ? `Mentions E-Verify: ${quote(flags.eVerify)}` : null,
      graduation_requirement: flags.graduation ? flags.graduation.slice(0, QUOTE_LIMIT) : null,
      job_description: description ? description.slice(0, DESCRIPTION_LIMIT) : null,
      notes: [
        `[discovery] source=${posting.source}`,
        `score ${score} = role ${breakdown.role} + sponsor ${breakdown.sponsor} + level ${breakdown.level} + location ${breakdown.location} + pay ${breakdown.pay} (title fit ×${fit}${noLevelSignal ? `, no level signal ×${levelFactor}` : ''})`,
        ...extras,
      ].join(' · '),
    },
  }
}
