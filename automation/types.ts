export type Ats = 'greenhouse' | 'lever' | 'ashby' | 'workday'
// From USCIS New Employment approvals in the latest complete fiscal year (see rules/sponsors.ts).
export type SponsorTier = 'strong' | 'some' | 'rare' | 'none'

export type Company = {
  name: string
  ats: Ats
  // greenhouse/lever/ashby: board slug. workday: "tenant/wdN/site".
  board: string
  // Names to look up in the USCIS data instead of `name`, when they differ (e.g. Fidelity → "FMR").
  h1bNames?: string[]
}

export type MetroConfig = { label: string; points: number; match: string[] }

export type Profile = {
  titleGroups: { A: string[]; B: string[]; C: string[] }
  excludeTitle: string[]
  rotationalTitle: string[]
  rotationalTechWords: string[]
  offTargetTitle: string[]
  fitWeights: { A: number; B: number; C: number; offTarget: number }
  noLevelSignalFactor: number
  maxRequiredYears: number
  // New Employment approvals in the latest complete fiscal year needed for each tier.
  sponsorTiers: { strong: number; some: number }
  sponsorPoints: Record<SponsorTier, number>
  metros: Record<string, MetroConfig>
  remoteUsPoints: number
  otherUsPoints: number
  skills: string[]
  minScore: number
  maxPerRun: number
  maxInternshipsPerRun: number
  simplifyLookbackDays: number
  maxEnrichPerRun: number
  workdaySearchTerms: string[]
  workdayMaxPagesPerTerm: number
}

// Simplify's own sponsorship label, passed through when the posting came from their list.
export type SimplifySponsorship =
  | 'Offers Sponsorship'
  | 'Does Not Offer Sponsorship'
  | 'U.S. Citizenship is Required'
  | 'Other'

// Source-agnostic posting, before any rules run.
export type RawPosting = {
  source: string
  company: string
  title: string
  url: string
  location: string
  // Plain text. null when the source gave none and enrichment failed.
  description: string | null
  workplaceHint: string | null
  salaryText: string | null
  simplifySponsorship: SimplifySponsorship | null
}

// Mirrors the fields accepted by supabase/functions/job-intake.
export type IntakeJob = {
  company: string
  role_title: string
  location: string | null
  job_link: string
  // Hidden in /jobs until the daily batch or "Next batch" promotes it to Found.
  status: 'Queued'
  priority: 'High' | 'Medium' | 'Low'
  job_type: 'New Grad' | 'Rotational Program' | 'Internship' | 'Other'
  work_mode: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'
  match_score: number
  required_skills: string | null
  sponsorship_notes: string | null
  e_verify_notes: string | null
  graduation_requirement: string | null
  job_description: string | null
  notes: string
}
