import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Company } from '../types.ts'
import { createChecker, greenhouseFromJid, parseBoardUrl, type Probes } from './boards.ts'

test('parseBoardUrl recognises each board URL shape', () => {
  assert.deepEqual(parseBoardUrl('https://job-boards.greenhouse.io/tanium/jobs/8176398'), { kind: 'greenhouse', board: 'tanium', id: '8176398' })
  assert.deepEqual(parseBoardUrl('https://boards.greenhouse.io/pendo/jobs/123?gh_src=x'), { kind: 'greenhouse', board: 'pendo', id: '123' })
  assert.deepEqual(parseBoardUrl('https://boards.greenhouse.io/embed/job_app?for=pendo&token=55'), { kind: 'greenhouse', board: 'pendo', id: '55' })
  assert.deepEqual(parseBoardUrl('https://jobs.lever.co/palantir/abc-123/apply'), { kind: 'lever', site: 'palantir', id: 'abc-123' })
  assert.deepEqual(parseBoardUrl('https://jobs.ashbyhq.com/ramp/9f1c'), { kind: 'ashby', board: 'ramp', id: '9f1c' })
  assert.deepEqual(parseBoardUrl('https://wf.wd1.myworkdayjobs.com/en-US/WellsFargoJobs/job/Charlotte-NC/Cloud-Engineer_R-1'), {
    kind: 'workday', apiBase: 'https://wf.wd1.myworkdayjobs.com/wday/cxs/wf/WellsFargoJobs', jobPath: '/job/Charlotte-NC/Cloud-Engineer_R-1',
  })
  assert.deepEqual(parseBoardUrl('https://wd1.myworkdaysite.com/recruiting/wf/WellsFargoJobs/job/X/Y_R-2'), {
    kind: 'workday', apiBase: 'https://wd1.myworkdaysite.com/wday/cxs/wf/WellsFargoJobs', jobPath: '/job/X/Y_R-2',
  })
  assert.equal(parseBoardUrl('https://careers.example.com/jobs/1'), null)
  assert.equal(parseBoardUrl('not a url'), null)
})

test('greenhouseFromJid uses the company board from companies.json', () => {
  const companies = [{ name: 'Bandwidth', ats: 'greenhouse', board: 'bandwidth' }] as Company[]
  assert.deepEqual(greenhouseFromJid('https://www.bandwidth.com/careers/?gh_jid=42', 'Bandwidth', companies), { kind: 'greenhouse', board: 'bandwidth', id: '42' })
  assert.equal(greenhouseFromJid('https://www.bandwidth.com/careers/?gh_jid=42', 'Other Co', companies), null)
  assert.equal(greenhouseFromJid('https://www.bandwidth.com/careers/', 'Bandwidth', companies), null)
})

// Fake network: url → [status, data]; a function throws (network error).
const probes = (routes: Record<string, [number, unknown] | (() => never)>, simplify = new Map<string, boolean>()): Probes & { calls: string[] } => {
  const calls: string[] = []
  const answer = (url: string) => {
    calls.push(url)
    const route = routes[url]
    if (typeof route === 'function') route()
    if (!route) throw new Error(`unexpected request ${url}`)
    return route as [number, unknown]
  }
  return {
    calls,
    json: async <T>(url: string) => {
      const [status, data] = answer(url)
      return { status, data: data as T | null }
    },
    status: async (url: string) => answer(url)[0],
    simplify: async () => simplify,
  }
}

const GH = 'https://boards-api.greenhouse.io/v1/boards'

test('greenhouse: listed is open, unlisted 404 is missing, and the board list is fetched once', async () => {
  const fake = probes({
    [`${GH}/pendo/jobs`]: [200, { jobs: [{ id: 1 }] }],
    [`${GH}/pendo/jobs/2`]: [404, null],
    [`${GH}/pendo/jobs/3`]: [200, {}],
  })
  const check = createChecker(fake)
  const ref = (id: string) => ({ kind: 'greenhouse', board: 'pendo', id }) as const
  assert.deepEqual(await check('', ref('1')), { result: 'open', via: 'greenhouse' })
  assert.deepEqual(await check('', ref('2')), { result: 'missing', via: 'greenhouse' })
  assert.deepEqual(await check('', ref('3')), { result: 'open', via: 'greenhouse' })
  assert.equal(fake.calls.filter((url) => url === `${GH}/pendo/jobs`).length, 1)
})

test('a board that does not answer never closes anything', async () => {
  const check = createChecker(probes({
    [`${GH}/renamed/jobs`]: [404, null],
    'https://api.lever.co/v0/postings/acme?mode=json': () => { throw new Error('timeout') },
    'https://api.ashbyhq.com/posting-api/job-board/gone': [404, null],
  }))
  assert.deepEqual(await check('', { kind: 'greenhouse', board: 'renamed', id: '1' }), { result: 'unverified', via: 'greenhouse' })
  assert.deepEqual(await check('', { kind: 'lever', site: 'acme', id: 'x' }), { result: 'unverified', via: 'lever' })
  assert.deepEqual(await check('', { kind: 'ashby', board: 'gone', id: 'x' }), { result: 'unverified', via: 'ashby' })
})

test('lever and ashby', async () => {
  const check = createChecker(probes({
    'https://api.lever.co/v0/postings/palantir?mode=json': [200, [{ id: 'a' }]],
    'https://api.lever.co/v0/postings/palantir/b': [404, null],
    'https://api.ashbyhq.com/posting-api/job-board/ramp': [200, { jobs: [{ id: 'listed' }] }],
  }))
  assert.equal((await check('', { kind: 'lever', site: 'palantir', id: 'a' })).result, 'open')
  assert.equal((await check('', { kind: 'lever', site: 'palantir', id: 'b' })).result, 'missing')
  assert.equal((await check('', { kind: 'ashby', board: 'ramp', id: 'listed' })).result, 'open')
  assert.equal((await check('', { kind: 'ashby', board: 'ramp', id: 'other' })).result, 'missing')
})

test('workday: flags, 404 only with a site that answers, other errors unverified', async () => {
  const base = 'https://wf.wd1.myworkdayjobs.com/wday/cxs/wf/WellsFargoJobs'
  const bad = 'https://wf.wd1.myworkdayjobs.com/wday/cxs/wf/Renamed'
  const check = createChecker(probes({
    [`${base}/job/open`]: [200, { jobPostingInfo: { canApply: true, posted: true } }],
    [`${base}/job/stopped`]: [200, { jobPostingInfo: { canApply: false, posted: true } }],
    [`${base}/job/gone`]: [404, null],
    [`${base}/job/blocked`]: [403, null],
    [`${base}/jobs`]: [200, { total: 1 }],
    [`${bad}/job/gone`]: [404, null],
    [`${bad}/jobs`]: [404, null],
  }))
  const ref = (apiBase: string, jobPath: string) => ({ kind: 'workday', apiBase, jobPath }) as const
  assert.equal((await check('', ref(base, '/job/open'))).result, 'open')
  assert.equal((await check('', ref(base, '/job/stopped'))).result, 'missing')
  assert.equal((await check('', ref(base, '/job/gone'))).result, 'missing')
  assert.equal((await check('', ref(base, '/job/blocked'))).result, 'unverified')
  assert.equal((await check('', ref(bad, '/job/gone'))).result, 'unverified')
})

test('other sites: Simplify active:false, then 404/410 only; redirects and errors are unverified', async () => {
  const check = createChecker(probes({
    'https://careers.example.com/a': [200, null],
    'https://careers.example.com/b': [404, null],
    'https://careers.example.com/c': [410, null],
    'https://careers.example.com/d': [302, null],
    'https://careers.example.com/e': [503, null],
    'https://careers.example.com/f': () => { throw new Error('timeout') },
  }, new Map([['https://careers.example.com/closed', false]])))
  assert.deepEqual(await check('https://careers.example.com/closed?utm_source=Simplify', null), { result: 'missing', via: 'simplify' })
  const results = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map(async (page) => (await check(`https://careers.example.com/${page}`, null)).result))
  assert.deepEqual(results, ['open', 'missing', 'missing', 'unverified', 'unverified', 'unverified'])
})
