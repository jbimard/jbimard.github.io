import type { Profile } from '../types.ts'

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

// Profiles from the database arrive as untyped JSON; this fails loudly on a missing or mistyped field instead of
// scoring a whole run with `undefined`. Returns the problems found (empty = fine).
export const profileProblems = (raw: unknown): string[] => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['profile is not an object']
  const profile = raw as Record<string, unknown>
  const problems: string[] = []
  const need = (key: string, ok: boolean) => { if (!ok) problems.push(`${key} is missing or the wrong type`) }

  const groups = profile.titleGroups as Record<string, unknown> | undefined
  need('titleGroups', typeof groups === 'object' && groups !== null && (['A', 'B', 'C'] as const).every((key) => isStringArray(groups[key])))
  for (const key of ['excludeTitle', 'rotationalTitle', 'rotationalTechWords', 'offTargetTitle', 'skills', 'workdaySearchTerms']) need(key, isStringArray(profile[key]))
  need('graduation', typeof profile.graduation === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(profile.graduation))
  for (const key of ['noLevelSignalFactor', 'maxRequiredYears', 'remoteUsPoints', 'otherUsPoints', 'minScore', 'maxPerRun', 'maxInternshipsPerRun', 'simplifyLookbackDays', 'maxEnrichPerRun', 'workdayMaxPagesPerTerm']) {
    need(key, typeof profile[key] === 'number' && Number.isFinite(profile[key]))
  }
  const weights = profile.fitWeights as Record<string, unknown> | undefined
  need('fitWeights', typeof weights === 'object' && weights !== null && ['A', 'B', 'C', 'offTarget'].every((key) => typeof weights[key] === 'number'))
  const metros = profile.metros as Record<string, Record<string, unknown>> | undefined
  need('metros', typeof metros === 'object' && metros !== null && Object.values(metros).every((metro) => (
    typeof metro?.label === 'string' && typeof metro.points === 'number' && isStringArray(metro.match)
  )))
  // Only used by profiles that need sponsorship, but the type requires them; a profile that doesn't can leave them out.
  if (profile.needsSponsorship !== false) {
    need('sponsorTiers', typeof profile.sponsorTiers === 'object' && profile.sponsorTiers !== null)
    need('sponsorPoints', typeof profile.sponsorPoints === 'object' && profile.sponsorPoints !== null)
  }
  if (profile.employerWatchlist !== undefined) need('employerWatchlist', isStringArray(profile.employerWatchlist))
  if (profile.companyTags !== undefined) need('companyTags', isStringArray(profile.companyTags))
  if (profile.targetYears !== undefined) need('targetYears', Array.isArray(profile.targetYears) && profile.targetYears.every((year) => Number.isInteger(year)))
  return problems
}

// Defaults for what a no-sponsorship profile may omit, so the rest of the code can treat every profile alike.
export const parseProfile = (raw: unknown): Profile => {
  const problems = profileProblems(raw)
  if (problems.length > 0) throw new Error(`Invalid profile: ${problems.join('; ')}`)
  const profile = raw as Profile
  return {
    ...profile,
    sponsorTiers: profile.sponsorTiers ?? { strong: 50, some: 5 },
    sponsorPoints: profile.sponsorPoints ?? { strong: 0, some: 0, rare: 0, none: 0, unknown: 0 },
  }
}
