export type Ats = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'icims' | 'jibe' | 'successfactors' | 'oracle' | 'radancy' | 'eightfold'
// From USCIS New Employment approvals in the latest complete fiscal year; 'unknown' means no USCIS record matched at all (see rules/sponsors.ts).
export type SponsorTier = 'strong' | 'some' | 'rare' | 'none' | 'unknown'

export type Company = {
  name: string
  ats: Ats
  // greenhouse/lever/ashby: board slug. workday: "tenant/wdN/site". icims: the search host's subdomain
  // ("globalcareers-sas" for globalcareers-sas.icims.com). jibe: the client code ("firstcitizens" for firstcitizens.jibeapply.com).
  // successfactors: the Career Site Builder host ("careers.duke.edu"). oracle: "{host}/{siteNumber}".
  // radancy: the career site host ("jobs.spectrum.com"). eightfold: "{host}/{domain}" ("apply.careers.microsoft.com/microsoft.com").
  board: string
  // Names to look up in the USCIS data instead of `name`, when they differ (e.g. Fidelity → "FMR").
  h1bNames?: string[]
  // Added to every posting's sponsorship notes, for news the USCIS counts can't show (e.g. a PERM suspension).
  sponsorNote?: string
  // workday: search filters, for global boards whose US jobs get crowded out (Accenture: locationCountry = US).
  workdayFacets?: Record<string, string[]>
  // Which profiles search this board (Profile.companyTags). Untagged boards are 'tech', the original list.
  tags?: string[]
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
  // Joseph's expected graduation, "YYYY-MM": postings whose graduation window excludes it score low.
  graduation: string
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
  // Also used by the other keyword-search boards: iCIMS, Jibe, SuccessFactors, Oracle, Radancy and Eightfold.
  workdaySearchTerms: string[]
  workdayMaxPagesPerTerm: number

  // ---- Optional per-user settings. Omitted = the original behaviour (a tech new grad who needs sponsorship). ----
  // false = no sponsorship needed: sponsor/pay points and the USCIS lookup are skipped, citizenship and
  // no-sponsorship wording stops mattering, and clearance roles are noted rather than blocked.
  needsSponsorship?: boolean
  // Graduation classes that count as "my year" (title/description wording). Default: the graduation year.
  targetYears?: number[]
  // Points for a group A/B/C title (and for an off-target group C title).
  rolePoints?: { A: number; B: number; C: number; offTarget: number }
  // Points for a clear entry-level signal; weaker signals scale from it (default 15).
  levelPoints?: number
  // Multiplies pay points; 0 turns pay off (default 1).
  payWeight?: number
  // Points per matching entry in `skills`, up to max (default: skills aren't scored).
  skillPoints?: { perMatch: number; max: number }
  // Employers worth a bonus, matched on the company name as a whole phrase.
  employerWatchlist?: string[]
  employerPoints?: number
  // Locations outside the listed metros (and not remote) are dropped instead of scoring otherUsPoints.
  metroOnly?: boolean
  // Boards to search: companies.json entries sharing a tag. Default ['tech'].
  companyTags?: string[]
  // Simplify's lists are tech-focused; false skips them.
  useSimplify?: boolean
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
