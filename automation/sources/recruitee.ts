import { fetchJson } from '../http.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, RawPosting } from '../types.ts'

// Recruitee career sites (locusbiosciences.recruitee.com): a public JSON list with full postings, so no detail call.
export type RecruiteeOffer = {
  title: string
  description?: string
  requirements?: string
  location?: string
  city?: string
  state_name?: string
  country_code?: string
  remote?: boolean
  hybrid?: boolean
  on_site?: boolean
  careers_url: string
  status?: string
}

export const recruiteePosting = (company: Company, offer: RecruiteeOffer): RawPosting => ({
  source: `recruitee:${company.board}`,
  company: company.name,
  title: offer.title.trim(),
  url: offer.careers_url,
  location: offer.location || [offer.city, offer.state_name, offer.country_code].filter(Boolean).join(', '),
  description: htmlToText([offer.description, offer.requirements].filter(Boolean).join('\n')) || null,
  workplaceHint: offer.remote ? 'Remote' : offer.hybrid ? 'Hybrid' : offer.on_site ? 'Onsite' : null,
  salaryText: null,
  simplifySponsorship: null,
})

export const fetchRecruitee = async (company: Company): Promise<RawPosting[]> => {
  const { offers } = await fetchJson<{ offers: RecruiteeOffer[] }>(`https://${company.board}.recruitee.com/api/offers/`)
  return offers
    // Recruitee reports a country code; anything explicitly outside the US is out of scope.
    .filter((offer) => (!offer.country_code || offer.country_code === 'US') && (!offer.status || offer.status === 'published'))
    .map((offer) => recruiteePosting(company, offer))
}
