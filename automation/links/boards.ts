// Is a job posting still open? Asks the job board's public API, cheapest and most reliable signal first.
// Every "missing" needs proof that the board itself answered (its list loaded), so a renamed board or an
// outage reads as "unverified" and never closes anything. No AI here.
import { fetchJson, probeJson, probeStatus } from '../http.ts'
import { linkKey } from '../sources/simplify.ts'
import type { Company } from '../types.ts'
import type { LinkResult, LinkVia } from './strikes.ts'

export type BoardRef =
  | { kind: 'greenhouse'; board: string; id: string }
  | { kind: 'lever'; site: string; id: string }
  | { kind: 'ashby'; board: string; id: string }
  // apiBase: "https://{host}/wday/cxs/{tenant}/{site}", jobPath starts with "/job/".
  | { kind: 'workday'; apiBase: string; jobPath: string }

// Works out which job board a posting URL belongs to (shared with enrich.ts).
export const parseBoardUrl = (rawUrl: string): BoardRef | null => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  const segments = url.pathname.split('/').filter(Boolean)

  if (/(^|\.)greenhouse\.io$/.test(url.hostname)) {
    const board = url.searchParams.get('for') ?? segments[0]
    const id = url.searchParams.get('token') ?? segments[segments.indexOf('jobs') + 1]
    return board && id ? { kind: 'greenhouse', board, id } : null
  }
  if (url.hostname === 'jobs.lever.co' && segments.length >= 2) return { kind: 'lever', site: segments[0], id: segments[1] }
  if (url.hostname === 'jobs.ashbyhq.com' && segments.length >= 2) return { kind: 'ashby', board: segments[0], id: segments[1] }

  // {tenant}.wdN.myworkdayjobs.com/[locale/]{site}/job/...  or  wdN.myworkdaysite.com/recruiting/{tenant}/{site}/job/...
  const jobIndex = segments.indexOf('job')
  const jobPath = `/${segments.slice(jobIndex).join('/')}`
  if (jobIndex > 0 && url.hostname.endsWith('.myworkdayjobs.com')) {
    const tenant = url.hostname.split('.')[0]
    return { kind: 'workday', apiBase: `https://${url.hostname}/wday/cxs/${tenant}/${segments[jobIndex - 1]}`, jobPath }
  }
  if (jobIndex > 2 && url.hostname.endsWith('.myworkdaysite.com') && segments[0] === 'recruiting') {
    const [, tenant, site] = segments
    return { kind: 'workday', apiBase: `https://${url.hostname}/wday/cxs/${tenant}/${site}`, jobPath }
  }
  return null
}

// Greenhouse boards hosted on a company's own site link as ".../careers?gh_jid=123"; the board comes from companies.json.
export const greenhouseFromJid = (rawUrl: string, company: string, companies: Company[]): BoardRef | null => {
  let id: string | null
  try {
    id = new URL(rawUrl).searchParams.get('gh_jid')
  } catch {
    return null
  }
  const match = companies.find((entry) => entry.ats === 'greenhouse' && entry.name.toLowerCase() === company.trim().toLowerCase())
  return id && match ? { kind: 'greenhouse', board: match.board, id } : null
}

export type Check = { result: LinkResult; via: LinkVia }

// Network calls, injectable for tests. probeJson/probeStatus throw on network errors and 5xx after retries.
export type Probes = {
  json: <T>(url: string, init?: RequestInit) => Promise<{ status: number; data: T | null }>
  status: (url: string) => Promise<number>
  // linkKey → Simplify's `active` flag, from both lists.
  simplify: () => Promise<Map<string, boolean>>
}

const GREENHOUSE = 'https://boards-api.greenhouse.io/v1/boards'
const LEVER = 'https://api.lever.co/v0/postings'
const ASHBY = 'https://api.ashbyhq.com/posting-api/job-board'
const SIMPLIFY_LISTS = [
  'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json',
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json',
]

export const liveProbes = (): Probes => {
  let simplify: Promise<Map<string, boolean>> | null = null
  return {
    json: probeJson,
    status: probeStatus,
    simplify: () => {
      simplify ??= Promise.all(SIMPLIFY_LISTS.map((url) => fetchJson<Array<{ url: string; active?: boolean }>>(url)))
        .then((lists) => new Map(lists.flat().map((listing) => [linkKey(listing.url), listing.active !== false])))
      return simplify
    },
  }
}

const ok = (status: number) => status >= 200 && status < 300
const gone = (status: number) => status === 404 || status === 410

export const createChecker = (probes: Probes) => {
  // One request per board, shared by every job on it. null = the board itself didn't answer.
  const lists = new Map<string, Promise<Set<string> | null>>()
  const boardIds = (key: string, load: () => Promise<Set<string> | null>) => {
    let cached = lists.get(key)
    if (!cached) {
      cached = load().catch(() => null)
      lists.set(key, cached)
    }
    return cached
  }

  const greenhouse = async (board: string, id: string): Promise<Check> => {
    const ids = await boardIds(`greenhouse:${board}`, async () => {
      const { status, data } = await probes.json<{ jobs: Array<{ id: number }> }>(`${GREENHOUSE}/${board}/jobs`)
      return ok(status) && data ? new Set(data.jobs.map((job) => String(job.id))) : null
    })
    if (!ids) return { result: 'unverified', via: 'greenhouse' }
    if (ids.has(id)) return { result: 'open', via: 'greenhouse' }
    // Not listed: confirm with the posting itself (it can be live but unlisted).
    const { status } = await probes.json(`${GREENHOUSE}/${board}/jobs/${id}`)
    return { result: gone(status) ? 'missing' : ok(status) ? 'open' : 'unverified', via: 'greenhouse' }
  }

  const lever = async (site: string, id: string): Promise<Check> => {
    const ids = await boardIds(`lever:${site}`, async () => {
      const { status, data } = await probes.json<Array<{ id: string }>>(`${LEVER}/${site}?mode=json`)
      return ok(status) && data ? new Set(data.map((posting) => posting.id)) : null
    })
    if (!ids) return { result: 'unverified', via: 'lever' }
    if (ids.has(id)) return { result: 'open', via: 'lever' }
    const { status } = await probes.json(`${LEVER}/${site}/${id}`)
    return { result: gone(status) ? 'missing' : ok(status) ? 'open' : 'unverified', via: 'lever' }
  }

  // Ashby has no single-posting API (its posting pages answer 200 even for made-up ids), so the list is the only signal.
  // It includes unlisted (isListed: false) postings, which are still open.
  const ashby = async (board: string, id: string): Promise<Check> => {
    const ids = await boardIds(`ashby:${board}`, async () => {
      const { status, data } = await probes.json<{ jobs: Array<{ id: string }> }>(`${ASHBY}/${board}`)
      return ok(status) && data ? new Set(data.jobs.map((job) => job.id)) : null
    })
    if (!ids) return { result: 'unverified', via: 'ashby' }
    return { result: ids.has(id) ? 'open' : 'missing', via: 'ashby' }
  }

  // Workday answers 404 for a closed posting, but also for a wrong site, so a 404 only counts when the site's
  // search answers. A live posting can also say canApply: false or posted: false.
  const workday = async (apiBase: string, jobPath: string): Promise<Check> => {
    const { status, data } = await probes.json<{ jobPostingInfo?: { canApply?: boolean; posted?: boolean } }>(`${apiBase}${jobPath}`)
    if (ok(status)) {
      const info = data?.jobPostingInfo
      return { result: info?.canApply === false || info?.posted === false ? 'missing' : 'open', via: 'workday' }
    }
    if (!gone(status)) return { result: 'unverified', via: 'workday' }
    const siteAnswers = await boardIds(`workday:${apiBase}`, async () => {
      const search = await probes.json(`${apiBase}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
      })
      return ok(search.status) ? new Set<string>() : null
    })
    return { result: siteAnswers ? 'missing' : 'unverified', via: 'workday' }
  }

  // Other career sites: only a 404/410 counts. Redirects, blocks and errors are "couldn't verify".
  const page = async (url: string): Promise<Check> => {
    const status = await probes.status(url)
    return { result: gone(status) ? 'missing' : ok(status) ? 'open' : 'unverified', via: 'http' }
  }

  return async (jobLink: string, ref: BoardRef | null): Promise<Check> => {
    const via: LinkVia = ref?.kind ?? 'http'
    try {
      if (ref?.kind === 'greenhouse') return await greenhouse(ref.board, ref.id)
      if (ref?.kind === 'lever') return await lever(ref.site, ref.id)
      if (ref?.kind === 'ashby') return await ashby(ref.board, ref.id)
      if (ref?.kind === 'workday') return await workday(ref.apiBase, ref.jobPath)
      // Simplify keeps closed roles in its lists with active: false.
      const active = await probes.simplify().then((map) => map.get(linkKey(jobLink))).catch(() => undefined)
      if (active === false) return { result: 'missing', via: 'simplify' }
      return await page(jobLink)
    } catch {
      return { result: 'unverified', via }
    }
  }
}
