const USER_AGENT = 'jbimard-job-discovery/1.0 (personal job search; +https://github.com/jbimard/jbimard.github.io)'
const REQUEST_DELAY_MS = 300
const TIMEOUT_MS = 20_000
const MAX_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class HttpError extends Error {
  status: number
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`)
    this.status = status
  }
}

// Each job board host gets its own queue: one request at a time with a fixed gap,
// so no board sees bursts from us, while different boards can be fetched in parallel.
const hostQueues = new Map<string, Promise<unknown>>()

const throttled = <T>(url: string, task: () => Promise<T>): Promise<T> => {
  const host = new URL(url).hostname
  const previous = hostQueues.get(host) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(() => sleep(REQUEST_DELAY_MS)).then(task)
  hostQueues.set(host, run.catch(() => undefined))
  return run
}

const request = async <T>(url: string, init: RequestInit): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        // Node's default "Accept-Language: *" makes some Workday tenants (e.g. Truist) return HTTP 500.
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en-US', ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new HttpError(response.status, url)
      return await response.json() as T
    } catch (error) {
      // Client errors (bad board id, missing posting) won't fix themselves on retry.
      const clientError = error instanceof HttpError && error.status >= 400 && error.status < 500
      if (clientError || attempt >= MAX_ATTEMPTS) throw error
      await sleep(1_000 * attempt)
    }
  }
}

export const fetchJson = <T>(url: string, init: RequestInit = {}) => throttled(url, () => request<T>(url, init))

// Like fetchJson, but a 4xx comes back as a status instead of an error: the link check needs to see 404s.
export const probeJson = <T>(url: string, init: RequestInit = {}) => throttled(url, async (): Promise<{ status: number; data: T | null }> => {
  try {
    return { status: 200, data: await request<T>(url, init) }
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) return { status: error.status, data: null }
    throw error
  }
})

// Status code of a career page, without following redirects (a redirect to a generic page proves nothing).
export const probeStatus = (url: string) => throttled(url, async () => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  await response.body?.cancel()
  return response.status
})

// Runs `task` over `items` with at most `limit` in flight, keeping results in input order.
export const mapWithConcurrency = async <Item, Result>(
  items: Item[],
  limit: number,
  task: (item: Item) => Promise<Result>,
): Promise<Result[]> => {
  const results = new Array<Result>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export const postJson = <T>(url: string, body: unknown, headers: Record<string, string> = {}) => (
  fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
)
