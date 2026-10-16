// Builds automation/data/h1b-sponsors.json from USCIS H-1B Employer Data Hub exports.
// Usage: npm run sponsors:build -- [--partial-year=2026]
// Put the CSV exports (one per fiscal year, or one multi-year file) in automation/data/raw/ first;
// USCIS blocks scripted downloads, so they are exported by hand from the hub. See docs/JOBS_SETUP.md §10.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildSponsorData, decodeExport, parseDelimited, readHubRows, serializeSponsorFile, toSponsorFile, type HubRow } from '../rules/sponsors.ts'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const RAW_DIR = path.join(DATA_DIR, 'raw')
const OUT_FILE = path.join(DATA_DIR, 'h1b-sponsors.json')

const main = async () => {
  const partialArg = process.argv.find((arg) => arg.startsWith('--partial-year='))?.split('=')[1]
  const partialYear = partialArg ? Number(partialArg) : null
  if (partialArg && !Number.isInteger(partialYear)) throw new Error(`--partial-year must be a year, got "${partialArg}".`)

  const files = (await readdir(RAW_DIR)).filter((file) => /\.(csv|tsv|txt)$/i.test(file)).sort()
  if (files.length === 0) throw new Error(`No .csv files in ${RAW_DIR}.`)

  const rows: HubRow[] = []
  for (const file of files) {
    const fileRows = readHubRows(parseDelimited(decodeExport(await readFile(path.join(RAW_DIR, file)))))
    const years = [...new Set(fileRows.map((row) => row.fiscalYear))].sort()
    console.log(`  ${file}: ${fileRows.length} rows, FY ${years.join(', ')}`)
    for (const row of fileRows) rows.push(row)
  }

  const data = buildSponsorData(rows, {
    source: 'USCIS H-1B Employer Data Hub (https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub), New Employment approvals',
    partialYear,
    builtAt: new Date().toISOString().slice(0, 10),
  })
  const json = serializeSponsorFile(toSponsorFile(data))
  await writeFile(OUT_FILE, json)
  console.log(`Wrote ${Object.keys(data.employers).length} employers, FY ${data.fiscalYears.join(', ')}${partialYear ? ` (FY${partialYear} partial)` : ''}, ${(json.length / 1024 / 1024).toFixed(2)} MB → ${path.relative(process.cwd(), OUT_FILE)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
