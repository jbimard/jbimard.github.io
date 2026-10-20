import type { IntakeJob, Profile, RawPosting } from '../types.ts'
import { detectFlags, type Flags } from './flags.ts'
import type { SponsorRecord } from './sponsors.ts'
import { findSkills, matchesAny, parseAnnualSalary, scoreLocation } from './text.ts'

export type TitleGroup = 'A' | 'B' | 'C'

const DEFAULT_ROLE_POINTS = { A: 30, B: 22, C: 12, offTarget: 6 }
const DEFAULT_LEVEL_POINTS = 15
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

export type Breakdown = { role: number; sponsor: number; level: number; location: number; pay: number; skills: number; employer: number; fit: number }

const needsSponsorship = (profile: Profile) => profile.needsSponsorship !== false
const targetYears = (profile: Profile) => profile.targetYears ?? [Number(profile.graduation.slice(0, 4))]

export type Evaluation =
  | { kind: 'irrelevant'; reason: string }
  | { kind: 'blocked'; reason: string; posting: RawPosting }
  | { kind: 'kept'; job: IntakeJob; breakdown: Breakdown; flags: Flags }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const quote = (sentence: string) => `"${sentence.length > QUOTE_LIMIT ? `${sentence.slice(0, QUOTE_LIMIT)}…` : sentence}"`

const sponsorPoints = (sponsor: SponsorRecord, flags: Flags, profile: Profile) => {
  if (!needsSponsorship(profile)) return 0
  let points = profile.sponsorPoints[sponsor.tier]
  if (flags.sponsorshipOffered || flags.eVerify) points += 5
  // No sponsorship means no H-1B path, and his truthful "now or in the future" answer usually fails the
  // application's first screen, so it costs more than any sponsor tier can make up.
  if (flags.noSponsorship) points -= 30
  if (flags.citizenship) points -= 20
  // Allowed below zero so penalties still bite for companies that start low (no USCIS record).
  return clamp(points, -30, 25)
}

const targetsMyYear = (flags: Flags, profile: Profile) => flags.targetYear !== null && targetYears(profile).includes(flags.targetYear)

const entryLevel = (flags: Flags, profile: Profile) => flags.internship || targetsMyYear(flags, profile) || flags.newGradSignal

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

const levelPoints = (flags: Flags, mismatch: string | null, profile: Profile) => {
  if (mismatch) return 0
  const full = profile.levelPoints ?? DEFAULT_LEVEL_POINTS
  const scaled = (points: number) => Math.round((full * points) / DEFAULT_LEVEL_POINTS)
  if (flags.returnToSchool) return scaled(5)
  if (flags.targetYear !== null && !targetsMyYear(flags, profile)) return scaled(5)
  if (entryLevel(flags, profile)) return full
  // No entry-level signal at all usually means an experienced hire.
  return scaled(3)
}

const UNKNOWN_PAY_POINTS = 7

const payBand = (annual: number) => {
  if (annual >= 140_000) return 15
  if (annual >= 120_000) return 13
  if (annual >= 100_000) return 11
  if (annual >= 85_000) return 9
  return 5
}

const payPoints = (annual: number | null, flags: Flags, profile: Profile) => {
  if (annual === null) return UNKNOWN_PAY_POINTS
  // High pay only helps (H-1B wage weighting) when the role is one Joseph can get;
  // on roles with no entry-level signal, a big number mostly means "senior".
  if (!entryLevel(flags, profile)) return Math.min(UNKNOWN_PAY_POINTS, payBand(annual))
  return payBand(annual)
}

const jobTypeOf = (flags: Flags, profile: Profile): IntakeJob['job_type'] => {
  if (flags.internship) return 'Internship'
  if (flags.rotational) return 'Rotational Program'
  if (entryLevel(flags, profile)) return 'New Grad'
  // No level signal either way — Claude screening decides later.
  return 'Other'
}

const priorityOf = (score: number): IntakeJob['priority'] => (score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low')

const sponsorshipNotes = (sponsor: SponsorRecord, flags: Flags, profile: Profile) => {
  const notes: string[] = []
  // Nobody to sponsor, so only the clearance warning is worth showing.
  if (!needsSponsorship(profile)) {
    if (flags.possibleClearance) notes.push(`⚠ Clearance possibly required: ${quote(flags.possibleClearance)}`)
    if (flags.clearance) notes.push(`⚠ Clearance mentioned: ${quote(flags.clearance)}`)
    return notes.length > 0 ? notes.join('\n') : null
  }
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
  // The one hard block: clearance roles need citizenship and can never work out (unless that's not an obstacle).
  if (flags.clearance && needsSponsorship(profile)) return { kind: 'blocked', reason: flags.clearance, posting }
  if (flags.requiredYears !== null && flags.requiredYears > profile.maxRequiredYears) {
    return { kind: 'irrelevant', reason: 'experience' }
  }

  const annual = parseAnnualSalary(posting.salaryText) ?? parseAnnualSalary(posting.description)
  const offTarget = isOffTarget(posting.title, group, profile)
  // Title fit scales everything else, so a great sponsor or big salary can't lift an unrelated role.
  const fit = offTarget ? profile.fitWeights.offTarget : profile.fitWeights[group]
  // No new-grad/intern/2027 wording at all: usually an experienced hire, so the whole score shrinks.
  const noLevelSignal = !entryLevel(flags, profile) && flags.targetYear === null && !flags.returnToSchool
  const levelFactor = noLevelSignal ? profile.noLevelSignalFactor : 1
  const weighted = (points: number) => Math.round(points * fit * levelFactor)
  const rolePoints = profile.rolePoints ?? DEFAULT_ROLE_POINTS
  const description = posting.description ?? ''
  const skills = findSkills(`${posting.title}\n${description}`, profile.skills)
  const breakdown: Breakdown = {
    role: Math.round((offTarget ? rolePoints.offTarget : rolePoints[group]) * levelFactor),
    sponsor: weighted(sponsorPoints(sponsor, flags, profile)),
    level: weighted(levelPoints(flags, mismatch, profile)),
    location: weighted(location.points),
    pay: weighted(payPoints(annual, flags, profile) * (profile.payWeight ?? 1)),
    skills: profile.skillPoints ? weighted(Math.min(profile.skillPoints.max, skills.length * profile.skillPoints.perMatch)) : 0,
    employer: profile.employerWatchlist && matchesAny(posting.company, profile.employerWatchlist) ? profile.employerPoints ?? 0 : 0,
    fit,
  }
  const total = Math.min(100, breakdown.role + breakdown.sponsor + breakdown.level + breakdown.location + breakdown.pay + breakdown.skills + breakdown.employer)
  // He can't truthfully apply to these, so they stay just under the cutoff however good the rest is.
  const score = blocker ? Math.min(total, profile.minScore - 1) : total

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
      job_type: jobTypeOf(flags, profile),
      work_mode: flags.workMode,
      match_score: score,
      required_skills: skills.length > 0 ? skills.join(', ') : null,
      sponsorship_notes: sponsorshipNotes(sponsor, flags, profile),
      e_verify_notes: flags.eVerify && needsSponsorship(profile) ? `Mentions E-Verify: ${quote(flags.eVerify)}` : null,
      graduation_requirement: flags.graduation ? flags.graduation.slice(0, QUOTE_LIMIT) : null,
      job_description: description ? description.slice(0, DESCRIPTION_LIMIT) : null,
      notes: [
        `[discovery] source=${posting.source}`,
        `score ${score} = role ${breakdown.role} + sponsor ${breakdown.sponsor} + level ${breakdown.level} + location ${breakdown.location} + pay ${breakdown.pay}${breakdown.skills ? ` + skills ${breakdown.skills}` : ''}${breakdown.employer ? ` + employer ${breakdown.employer}` : ''} (title fit ×${fit}${noLevelSignal ? `, no level signal ×${levelFactor}` : ''})`,
        ...extras,
      ].join(' · '),
    },
  }
}
