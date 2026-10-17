// Step 4: the visa timeline card. Pure date logic so it can be tested without a browser (visaTimeline.test.ts).
// Everything is worked out from the dates in visa_profile; nothing here is legal advice, and the card says to confirm
// every date with the school's DSO.
//
// Rules used (8 CFR 214.2(f)):
// - Post-completion OPT: file from 90 days before the program end date to 60 days after it, and within 30 days of the
//   DSO's recommendation. 12 months, which must end within 14 months of the program end date.
// - Unemployment: 90 days on OPT, counted from the EAD start date. STEM OPT adds 60 (150 in total across both), but
//   STEM OPT itself needs a job with an E-Verify employer, so the first job has to come within the 90.
// - STEM OPT: file up to 90 days before the OPT EAD ends (USCIS must receive it before then), within 60 days of the
//   DSO's recommendation, for an E-Verify employer. 24 months.
// - H-1B registration each March; the petition is filed from April 1, so status must still be valid then. Cap-gap
//   carries F-1 status from the end of OPT to the H-1B start.

export interface VisaProfile {
  program_end_date: string
  opt_start_date: string | null
  opt_end_date: string | null
  stem_opt_end_date: string | null
  unemployed_days_logged: number
  unemployed_since: string | null
}

export type MilestoneState = 'done' | 'past' | 'open' | 'upcoming'

export interface Milestone {
  key: string
  title: string
  start: string
  end: string | null
  state: MilestoneState
  // True when a date is worked out from the program end date rather than taken from an EAD card.
  estimated: boolean
  note: string
}

export interface Unemployment {
  started: boolean
  used: number
  limit: 90 | 150
  left: number
  // The day the limit is reached if the current gap continues; null while working.
  runsOut: string | null
}

const DAY = 86_400_000

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10)

export const addDays = (date: string, days: number) => fromTime(toTime(date) + days * DAY)

// Calendar months, clamped to the last day of a shorter month (Jan 31 + 1 month = Feb 28).
export const addMonths = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return fromTime(target.getTime())
}

export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY)

const stateFor = (start: string, end: string, today: string): MilestoneState => {
  if (today < start) return 'upcoming'
  if (today > end) return 'past'
  return 'open'
}

// OPT end as approved, or estimated as 12 months from the day after the program ends.
export const optEnd = (profile: VisaProfile) => ({
  date: profile.opt_end_date ?? addMonths(profile.program_end_date, 12),
  estimated: !profile.opt_end_date,
})

// The last day of work authorization: STEM OPT end if approved, otherwise OPT end plus 24 months as the best case.
export const authorizationEnd = (profile: VisaProfile) => {
  if (profile.stem_opt_end_date) return { date: profile.stem_opt_end_date, estimated: false }
  return { date: addMonths(optEnd(profile).date, 24), estimated: true }
}

export function milestones(profile: VisaProfile, today: string): Milestone[] {
  const end = profile.program_end_date
  const opt = optEnd(profile)
  const list: Milestone[] = []

  const optOpen = addDays(end, -90)
  const optClose = addDays(end, 60)
  list.push({
    key: 'opt-filing',
    title: 'File for OPT (I-765)',
    start: optOpen,
    end: optClose,
    state: profile.opt_start_date ? 'done' : stateFor(optOpen, optClose, today),
    estimated: false,
    note: 'Ask the DSO for the OPT recommendation first, then file within 30 days of it. Pick an OPT start date within 60 days after the program ends.',
  })

  list.push({
    key: 'program-end',
    title: 'Program ends',
    start: end,
    end: null,
    state: today >= end ? 'past' : 'upcoming',
    estimated: false,
    note: `OPT has to end by ${addMonths(end, 14)} (14 months after the program end date).`,
  })

  if (profile.opt_start_date) {
    list.push({
      key: 'opt',
      title: 'OPT',
      start: profile.opt_start_date,
      end: opt.date,
      state: stateFor(profile.opt_start_date, opt.date, today),
      estimated: opt.estimated,
      note: 'The unemployment clock starts on the OPT start date.',
    })
  }

  const stemOpen = addDays(opt.date, -90)
  list.push({
    key: 'stem-filing',
    title: 'File for STEM OPT (I-765)',
    start: stemOpen,
    end: opt.date,
    state: profile.stem_opt_end_date ? 'done' : stateFor(stemOpen, opt.date, today),
    estimated: opt.estimated,
    note: 'Needs an E-Verify employer and a signed I-983 training plan. USCIS must receive it before OPT ends, within 60 days of the DSO recommendation.',
  })

  const authEnd = authorizationEnd(profile)
  const firstYear = Number(end.slice(0, 4))
  const lastYear = Number(authEnd.date.slice(0, 4))
  for (let year = firstYear; year <= lastYear; year += 1) {
    // The petition is filed from April 1, so status has to last until then.
    if (authEnd.date < `${year}-04-01`) break
    list.push({
      key: `h1b-${year}`,
      title: `H-1B registration · FY${year + 1}`,
      start: `${year}-03-01`,
      end: `${year}-03-31`,
      state: stateFor(`${year}-03-01`, `${year}-03-31`, today),
      estimated: true,
      note: `The employer registers; USCIS announces the exact dates each February. If selected, the job starts October 1, ${year}, and cap-gap covers the time between.`,
    })
  }

  return list.sort((a, b) => a.start.localeCompare(b.start))
}

// The open window that closes soonest, or else the next one to open.
export function nextMilestone(list: Milestone[]): Milestone | null {
  const open = list.filter((item) => item.state === 'open' && item.end)
    .sort((a, b) => a.end!.localeCompare(b.end!))
  if (open.length > 0) return open[0]
  return list.find((item) => item.state === 'upcoming') ?? null
}

export function unemployment(profile: VisaProfile, today: string): Unemployment {
  const limit = profile.stem_opt_end_date ? 150 : 90
  if (!profile.opt_start_date || today < profile.opt_start_date) {
    return { started: false, used: 0, limit, left: limit, runsOut: null }
  }

  // Count the current gap from no earlier than the OPT start date, and count today (the safer side for a limit).
  const since = profile.unemployed_since && profile.unemployed_since > profile.opt_start_date ? profile.unemployed_since : profile.opt_start_date
  const current = profile.unemployed_since && today >= since ? daysBetween(since, today) + 1 : 0
  const used = profile.unemployed_days_logged + current
  const left = Math.max(0, limit - used)
  const runsOut = profile.unemployed_since ? addDays(since, limit - profile.unemployed_days_logged - 1) : null

  return { started: true, used, limit, left, runsOut }
}

// Rules still in motion. Reviewed by hand; update `checked` and the wording when the status changes.
export interface WatchItem {
  key: string
  title: string
  status: string
  impact: string
  link: string
  checked: string
}

export function watchList(today: string): WatchItem[] {
  return [
    {
      key: 'opt-fee',
      title: 'Proposed OPT fees ($70,000 first OPT, $30,000 STEM OPT)',
      status: today <= '2026-11-09'
        ? 'Proposed 2026-10-08 (docket ICEB-2026-0100). Not in effect; comments close 2026-11-09.'
        : 'Proposed 2026-10-08 (docket ICEB-2026-0100). Comments closed 2026-11-09; not in effect unless a final rule is published.',
      impact: 'The school would pay it before the DSO can recommend OPT. A final rule before the OPT recommendation could change whether the school recommends OPT. Ask the international office (ISSS) what it plans.',
      link: 'https://www.regulations.gov/document/ICEB-2026-0100-0001',
      checked: '2026-10-16',
    },
    {
      key: 'h1b-weighted',
      title: 'Wage-weighted H-1B lottery',
      status: 'In effect since the FY2027 season (March 2026).',
      impact: 'Each registration gets one entry per wage level (Level I: 1, Level IV: 4), so higher offers have better odds. Entry-level offers are usually Level I or II.',
      link: 'https://www.federalregister.gov/documents/2025/12/29/2025-23853/weighted-selection-process-for-registrants-and-petitioners-seeking-to-file-cap-subject-h-1b',
      checked: '2026-10-16',
    },
    {
      key: 'h1b-100k',
      title: '$100,000 H-1B fee',
      status: 'Struck down by a federal court on 2026-06-08; the First Circuit refused to reinstate it on 2026-07-24. The appeal continues.',
      impact: 'Never applied to a change of status inside the US, such as F-1 or OPT to H-1B (USCIS guidance, October 2025).',
      link: 'https://www.colorado.edu/isss/2026/10/07/100000-h-1b-fee-current-status',
      checked: '2026-10-16',
    },
  ]
}
