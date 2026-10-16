import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseIcimsJob, parseIcimsSearch } from './icims.ts'
import { jibePosting } from './jibe.ts'

// Trimmed from globalcareers-sas.icims.com (2026-10-16).
const card = (id: string, title: string, fields: Array<[string, string]>) => `
<li class="iCIMS_JobCardItem">
<div class="row"><div class="col-xs-12 title">
<a href="https://global-sas.icims.com/jobs/${id}/slug/job?hub=9&amp;in_iframe=1" class="iCIMS_Anchor" title="${id} - ${title}">
<span class="sr-only field-label">Requisition Title</span>
<h3 >
${title}</h3></a></div>
<div class="col-xs-12 additionalFields"><dl class="iCIMS_JobHeaderGroup">
${fields.map(([label, value]) => `<div class="iCIMS_JobHeaderTag">
<dt class="iCIMS_JobHeaderField"><span class="glyphicons glyphicons-map-marker" aria-hidden="true"></span>
<span class="sr-only field-label">${label}</span>
</dt>
<dd class="iCIMS_JobHeaderData"><span >
${value}</span>
</dd></div>`).join('\n')}
</dl></div></div></li>`

test('iCIMS search: cards, location from the card fields, clean links, page count', () => {
  const html = `<div>Page 1 of 4</div><ul class="container-fluid iCIMS_JobsTable">
${card('44553', 'Cloud Services Delivery Manager', [['Requisition ID', '20071860'], [' Country (Full Name)', 'United Kingdom'], ['City', 'Marlow']])}
${card('43001', 'Security Engineer &amp; Analyst', [[' Country (Full Name)', 'United States'], ['Primary Location (Advertised location) : State/Province (Full Name)', 'North Carolina'], ['City', 'Cary HQ']])}
</ul>`
  const { items, pages } = parseIcimsSearch(html)
  assert.equal(pages, 4)
  assert.deepEqual(items, [
    { id: '44553', title: 'Cloud Services Delivery Manager', url: 'https://global-sas.icims.com/jobs/44553/slug/job', location: 'Marlow, United Kingdom' },
    { id: '43001', title: 'Security Engineer & Analyst', url: 'https://global-sas.icims.com/jobs/43001/slug/job', location: 'Cary HQ, North Carolina, United States' },
  ])
  assert.deepEqual(parseIcimsSearch('<p>No jobs</p>'), { items: [], pages: 1 })
})

test('iCIMS posting: the schema.org JobPosting block, skipping broken and unrelated ones', () => {
  const posting = {
    '@context': 'http://schema.org',
    '@type': 'JobPosting',
    title: 'Cloud Security Engineer ',
    description: '<p>Protect <strong>Azure</strong> &amp; AWS workloads.</p>',
    url: 'https://global-sas.icims.com/jobs/1/x/job',
    jobLocation: [{ address: { addressLocality: 'Cary', addressRegion: 'NC', addressCountry: 'US', streetAddress: 'UNAVAILABLE' } }],
  }
  const html = `<script type="application/ld+json">{not json</script>
<script type="application/ld+json">{"@type":"Organization","name":"SAS"}</script>
<script type="application/ld+json">${JSON.stringify(posting)}</script>`
  const job = parseIcimsJob(html)
  assert.equal(job?.title, 'Cloud Security Engineer')
  assert.equal(job?.location, 'Cary, NC, US')
  assert.equal(job?.url, 'https://global-sas.icims.com/jobs/1/x/job')
  assert.match(job?.description ?? '', /Protect Azure & AWS workloads\./)
  assert.equal(parseIcimsJob('<html>closed</html>'), null)
})

test('Jibe posting: public job page link, full location, plain description', () => {
  const company = { name: 'First Citizens Bank', ats: 'jibe' as const, board: 'firstcitizens' }
  const raw = jibePosting(company, {
    slug: '36003',
    title: ' Cloud Engineer ',
    description: 'Overview <b>Build</b> on AWS.',
    full_location: 'Phoenix, Arizona; Raleigh, North Carolina',
    short_location: 'Phoenix, Arizona',
  })
  assert.equal(raw.url, 'https://firstcitizens.jibeapply.com/jobs/36003')
  assert.equal(raw.title, 'Cloud Engineer')
  assert.equal(raw.location, 'Phoenix, Arizona; Raleigh, North Carolina')
  assert.equal(raw.source, 'jibe:firstcitizens')
  assert.match(raw.description ?? '', /Overview Build on AWS\./)
})
