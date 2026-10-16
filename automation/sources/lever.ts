import { fetchJson } from '../http.ts'
import { htmlToText } from '../rules/text.ts'
import type { Company, RawPosting } from '../types.ts'

export type LeverPosting = {
  id: string
  text: string
  hostedUrl: string
  country?: string
  workplaceType?: string
  categories?: { location?: string; allLocations?: string[] }
  descriptionPlain?: string
  lists?: Array<{ text?: string; content?: string }>
  additionalPlain?: string
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string }
}

const API = 'https://api.lever.co/v0/postings'

export const leverDescription = (posting: LeverPosting) => (
  [
    posting.descriptionPlain,
    ...(posting.lists ?? []).map((list) => `${list.text ?? ''}\n${htmlToText(list.content ?? '')}`),
    posting.additionalPlain,
  ].filter(Boolean).join('\n').trim() || null
)

const leverSalary = (posting: LeverPosting) => {
  const range = posting.salaryRange
  if (!range?.min || range.currency !== 'USD') return null
  const unit = range.interval?.includes('hour') ? '/hr' : ''
  return `$${range.min}${unit} - $${range.max ?? range.min}${unit}`
}

export const fetchLeverPosting = (site: string, id: string) => fetchJson<LeverPosting>(`${API}/${site}/${id}`)

export const fetchLever = async (company: Company): Promise<RawPosting[]> => {
  const postings = await fetchJson<LeverPosting[]>(`${API}/${company.board}?mode=json`)
  return postings
    // Lever reports a country code; anything explicitly outside the US is out of scope.
    .filter((posting) => !posting.country || posting.country === 'US')
    .map((posting) => ({
      source: `lever:${company.board}`,
      company: company.name,
      title: posting.text.trim(),
      url: posting.hostedUrl,
      location: (posting.categories?.allLocations?.join('; ') || posting.categories?.location) ?? '',
      description: leverDescription(posting),
      workplaceHint: posting.workplaceType ?? null,
      salaryText: leverSalary(posting),
      simplifySponsorship: null,
    }))
}
