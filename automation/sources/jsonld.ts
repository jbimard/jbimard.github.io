import { htmlToText } from '../rules/text.ts'

export type JobPostingLdResult = { title: string; description: string | null; location: string; url: string | null }

type JobPlace = { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
type JobPostingLd = {
  '@type'?: string
  title?: string
  description?: string
  url?: string
  // One place or a list of them.
  jobLocation?: JobPlace | JobPlace[]
}

// A posting page's schema.org JobPosting block (what Google for Jobs reads), or null when the page has none (closed
// posting or changed layout). Used by the boards whose posting pages are HTML: iCIMS and Radancy.
export const parseJobPostingLd = (html: string): JobPostingLdResult | null => {
  for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data: JobPostingLd
    try {
      data = JSON.parse(body) as JobPostingLd
    } catch {
      continue
    }
    if (data['@type'] !== 'JobPosting' || !data.title) continue
    const location = [data.jobLocation ?? []].flat()
      .map(({ address }) => [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter((part) => part && part !== 'UNAVAILABLE').join(', '))
      .filter(Boolean)
      .join('; ')
    return { title: data.title.trim(), description: data.description ? htmlToText(data.description) : null, location, url: data.url ?? null }
  }
  return null
}
