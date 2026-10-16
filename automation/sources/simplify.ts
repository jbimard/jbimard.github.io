import { fetchJson } from '../http.ts'
import { titleGroup } from '../rules/score.ts'
import type { Company, Profile, RawPosting, SimplifySponsorship } from '../types.ts'

type SimplifyListing = {
  company_name: string
  title: string
  url: string
  locations?: string[]
  active?: boolean
  is_visible?: boolean
  date_posted?: number
  sponsorship?: SimplifySponsorship
}

const LISTS = [
  { name: 'newgrad', url: 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json' },
  { name: 'intern', url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json' },
]

// Simplify appends tracking params; drop them so the same posting dedupes across sources.
export const stripTracking = (url: string) => {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|^ref$|^source$/i.test(key)) parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

// Simplify listings carry no description; enrich.ts fills it in afterwards where possible.
export const fetchSimplify = async (companies: Company[], profile: Profile): Promise<RawPosting[]> => {
  const knownSponsors = new Set(
    companies.filter((company) => company.sponsorTier === 'known').map((company) => company.name.toLowerCase()),
  )
  const cutoff = Date.now() / 1000 - profile.simplifyLookbackDays * 86_400
  const postings: RawPosting[] = []

  for (const list of LISTS) {
    const listings = await fetchJson<SimplifyListing[]>(list.url)
    for (const listing of listings) {
      if (!listing.active || listing.is_visible === false) continue
      if ((listing.date_posted ?? 0) < cutoff) continue
      if (!titleGroup(listing.title, profile)) continue

      postings.push({
        source: `simplify:${list.name}`,
        company: listing.company_name.trim(),
        title: listing.title.trim(),
        url: stripTracking(listing.url),
        location: (listing.locations ?? []).join('; '),
        description: null,
        workplaceHint: null,
        salaryText: null,
        sponsorTier: knownSponsors.has(listing.company_name.trim().toLowerCase()) ? 'known' : 'unknown',
        simplifySponsorship: listing.sponsorship ?? null,
      })
    }
  }
  return postings
}
