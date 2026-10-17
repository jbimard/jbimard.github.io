import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eightfoldUrl } from './eightfold.ts'
import { parseIcimsSearch } from './icims.ts'
import { jibePosting } from './jibe.ts'
import { parseJobPostingLd } from './jsonld.ts'
import { oracleDescription, oracleLocation, oracleUrl } from './oracle.ts'
import { parseRadancyResults } from './radancy.ts'
import { parseSuccessFactorsJob, parseSuccessFactorsSearch } from './successfactors.ts'

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

test('posting pages: the schema.org JobPosting block, skipping broken and unrelated ones', () => {
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
  const job = parseJobPostingLd(html)
  assert.equal(job?.title, 'Cloud Security Engineer')
  assert.equal(job?.location, 'Cary, NC, US')
  assert.equal(job?.url, 'https://global-sas.icims.com/jobs/1/x/job')
  assert.match(job?.description ?? '', /Protect Azure & AWS workloads\./)
  assert.equal(parseJobPostingLd('<html>closed</html>'), null)
  // Radancy gives one place instead of a list.
  const single = parseJobPostingLd(`<script type="application/ld+json">${JSON.stringify({ ...posting, jobLocation: { address: { addressLocality: 'Raleigh', addressRegion: 'NC' } } })}</script>`)
  assert.equal(single?.location, 'Raleigh, NC')
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

test('SuccessFactors search: rows, absolute links, location, total', () => {
  const row = (path: string, title: string, location: string) => `<tr class="data-row">
<td class="colTitle"><span class="jobTitle hidden-phone"><a href="${path}" class="jobTitle-link">${title}</a></span>
<div class="jobdetail-phone visible-phone"><span class="jobTitle visible-phone"><a class="jobTitle-link" href="${path}">${title}</a></span>
<span class="jobLocation visible-phone"><span class="jobLocation">
            ${location}
        </span></span></div></td></tr>`
  const html = `<span class="paginationLabel" aria-label="Results 1 – 25">Results <b>1 – 25</b> of <b>1,105</b></span><table>
${row('/job/Durham-Consultant%2C-IT-NC-27710/1431545500/', 'Consultant, IT', 'Durham, NC, US, 27710')}
${row('/job/Durham-Cloud-Engineer-NC-27710/1400000000/', 'Cloud &amp; Security Engineer', 'Durham, NC, US')}
</table>`
  const { items, total } = parseSuccessFactorsSearch(html, 'careers.duke.edu')
  assert.equal(total, 1105)
  assert.deepEqual(items, [
    { id: '1431545500', title: 'Consultant, IT', url: 'https://careers.duke.edu/job/Durham-Consultant%2C-IT-NC-27710/1431545500/', location: 'Durham, NC, US, 27710' },
    { id: '1400000000', title: 'Cloud & Security Engineer', url: 'https://careers.duke.edu/job/Durham-Cloud-Engineer-NC-27710/1400000000/', location: 'Durham, NC, US' },
  ])
})

test('SuccessFactors posting: the whole jobdescription span, nested spans included', () => {
  const html = `<span itemprop="description"><span class="jobdescription"><p>Build <span>cloud</span> tools.</p><p>Use <b>Azure</b>.</p></span></span><span>Footer</span>`
  const description = parseSuccessFactorsJob(html) ?? ''
  assert.match(description, /^Build cloud tools\.\nUse Azure/)
  assert.doesNotMatch(description, /Footer/)
  assert.equal(parseSuccessFactorsJob('<p>No description</p>'), null)
})

test('Oracle: job link, primary plus secondary locations, description in posting order', () => {
  assert.equal(oracleUrl('ibqbjb.fa.ocs.oraclecloud.com', 'CX_1', '160254'), 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/160254')
  assert.equal(oracleLocation({ Id: '1', Title: 'x', PrimaryLocation: 'Charlotte, NC, United States', secondaryLocations: [{ Name: 'Atlanta, GA, United States' }, {}] }), 'Charlotte, NC, United States; Atlanta, GA, United States')
  assert.equal(oracleDescription({ ExternalDescriptionStr: '<p>About the role.</p>', ExternalResponsibilitiesStr: null, ExternalQualificationsStr: '<ul><li>Python</li></ul>' }), 'About the role.\n• Python')
  assert.equal(oracleDescription({ ExternalDescriptionStr: ' ', ExternalResponsibilitiesStr: null }), null)
})

test('Radancy results: links, titles, locations, total', () => {
  const html = `<section data-total-results="90"><ul>
<li><a href="/job/raleigh/senior-lead-cloud-architect/4673/102011306064" data-job-id="102011306064">
<h2>Senior Lead Cloud Architect &amp; Engineer</h2>
<span class="job-location">Raleigh, NC</span><span class="job-date-posted">10/15/2026</span></a></li>
<li><a href="/job/charlotte/security-engineer/4673/1" data-job-id="1"><h2>Security Engineer</h2><span class="job-location">Charlotte, NC</span></a></li>
</ul></section>`
  const { items, total } = parseRadancyResults(html, 'jobs.spectrum.com')
  assert.equal(total, 90)
  assert.deepEqual(items, [
    { id: '102011306064', title: 'Senior Lead Cloud Architect & Engineer', url: 'https://jobs.spectrum.com/job/raleigh/senior-lead-cloud-architect/4673/102011306064', location: 'Raleigh, NC' },
    { id: '1', title: 'Security Engineer', url: 'https://jobs.spectrum.com/job/charlotte/security-engineer/4673/1', location: 'Charlotte, NC' },
  ])
})

test('Eightfold: public link when given, else built from the id', () => {
  assert.equal(eightfoldUrl('apply.careers.microsoft.com', { id: 1, name: 'x', publicUrl: 'https://apply.careers.microsoft.com/careers/job/1' }), 'https://apply.careers.microsoft.com/careers/job/1')
  assert.equal(eightfoldUrl('apply.careers.microsoft.com', { id: 1970393556942310, name: 'x' }), 'https://apply.careers.microsoft.com/careers/job/1970393556942310')
})
