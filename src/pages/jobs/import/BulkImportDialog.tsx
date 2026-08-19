import { useMemo, useState } from 'react'
import { copyToClipboard } from '../prompts'
import type { Job, JobDraft } from '../types'
import { JOB_INTAKE_SCHEMA_TEXT } from './jobIntakeSchema'
import { parseJobIntakeJson } from './normalizeJobIntake'
import {
  buildJobIntakeReport,
  toJobDraft,
  willImport,
  type JobIntakeRowResult,
} from './validateJobIntake'

type BulkImportDialogProps = {
  existingJobs: Job[]
  onClose: () => void
  onImport: (drafts: Omit<JobDraft, 'user_id'>[]) => Promise<Job[]>
}

type ImportResult = {
  imported: number
  skippedInvalid: number
  skippedDuplicate: number
}

const statusClass = (row: JobIntakeRowResult) => {
  if (row.errors.length > 0) return 'border-red-200 bg-red-50 text-red-700'
  if (row.duplicateBlocked) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (row.duplicateWarning) return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

const statusLabel = (row: JobIntakeRowResult) => {
  if (row.errors.length > 0) return 'Invalid'
  if (row.duplicateBlocked) return 'Duplicate blocked'
  if (row.duplicateWarning) return 'Duplicate warning'
  return 'Ready'
}

const BulkImportDialog = ({ existingJobs, onClose, onImport }: BulkImportDialogProps) => {
  const [view, setView] = useState<'input' | 'success'>('input')
  const [jsonText, setJsonText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<JobIntakeRowResult[] | null>(null)
  const [allowDuplicates, setAllowDuplicates] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)

  const counts = useMemo(() => {
    const currentRows = rows ?? []
    return {
      ready: currentRows.filter((row) => willImport(row, allowDuplicates)).length,
      invalid: currentRows.filter((row) => row.errors.length > 0).length,
      duplicates: currentRows.filter((row) => row.duplicateBlocked && !allowDuplicates).length,
      hasDuplicateLinks: allowDuplicates || currentRows.some((row) => row.duplicateBlocked),
    }
  }, [allowDuplicates, rows])

  const validateText = (nextAllowDuplicates = allowDuplicates) => {
    const parsed = parseJobIntakeJson(jsonText)
    setImportError(null)

    if (!parsed.ok) {
      setRows(null)
      setParseError(parsed.error)
      return
    }

    setParseError(null)
    setRows(buildJobIntakeReport(parsed.rows, existingJobs, nextAllowDuplicates))
  }

  const recomputeDuplicates = (nextAllowDuplicates: boolean) => {
    setAllowDuplicates(nextAllowDuplicates)
    setImportError(null)
    setRows((currentRows) => (
      currentRows
        ? buildJobIntakeReport(currentRows.map((row) => row.input), existingJobs, nextAllowDuplicates)
        : currentRows
    ))
  }

  const copySchema = async () => {
    await copyToClipboard(JOB_INTAKE_SCHEMA_TEXT)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const importValidJobs = async () => {
    if (!rows) return

    const importableRows = rows.filter((row) => willImport(row, allowDuplicates))
    const drafts = importableRows.map((row) => toJobDraft(row.normalized))

    setImporting(true)
    setImportError(null)
    try {
      const imported = await onImport(drafts)
      setResult({
        imported: imported.length,
        skippedInvalid: rows.filter((row) => row.errors.length > 0).length,
        skippedDuplicate: rows.filter((row) => row.duplicateBlocked && !allowDuplicates).length,
      })
      setView('success')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import jobs.')
    } finally {
      setImporting(false)
    }
  }

  const resetForAnotherBatch = () => {
    setView('input')
    setJsonText('')
    setParseError(null)
    setRows(null)
    setAllowDuplicates(false)
    setImportError(null)
    setResult(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Bulk import jobs</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Close</button>
        </header>

        {view === 'success' && result ? (
          <div className="flex flex-1 flex-col px-5 py-4">
            <section className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold">Import complete</p>
              <p className="mt-1">
                {result.imported} imported · {result.skippedInvalid} invalid skipped · {result.skippedDuplicate} duplicates skipped
              </p>
            </section>
            <footer className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={resetForAnotherBatch} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                Import another batch
              </button>
              <button type="button" onClick={onClose} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Close
              </button>
            </footer>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <label className="block text-sm font-medium text-slate-700">
              JSON jobs
              <textarea
                value={jsonText}
                onChange={(event) => {
                  setJsonText(event.target.value)
                  setRows(null)
                  setParseError(null)
                  setImportError(null)
                }}
                rows={12}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-700"
              />
            </label>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => void copySchema()} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                {copied ? 'Copied schema' : 'Copy JSON schema'}
              </button>
              <button type="button" onClick={() => validateText()} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Validate
              </button>
            </div>

            {parseError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{parseError}</p>}

            {rows && (
              <section className="mt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    {counts.ready} ready to import · {counts.invalid} invalid · {counts.duplicates} duplicates blocked
                  </p>
                  {counts.hasDuplicateLinks && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={allowDuplicates}
                        onChange={(event) => recomputeDuplicates(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Allow duplicates
                    </label>
                  )}
                </div>

                <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2 font-semibold">#</th>
                        <th className="border-b border-slate-200 px-3 py-2 font-semibold">Company</th>
                        <th className="border-b border-slate-200 px-3 py-2 font-semibold">Role</th>
                        <th className="border-b border-slate-200 px-3 py-2 font-semibold">Status</th>
                        <th className="border-b border-slate-200 px-3 py-2 font-semibold">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.index} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-slate-500">{row.index + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{row.normalized.company || 'Missing'}</td>
                          <td className="px-3 py-2 text-slate-700">{row.normalized.role_title || 'Missing'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(row)}`}>
                              {statusLabel(row)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.errors.length > 0 ? row.errors.join('; ') : row.duplicateWarning ? 'Company and role match an existing job.' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {importError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>}

            <footer className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-slate-200 bg-white py-4">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={!rows || counts.ready === 0 || importing}
                onClick={() => void importValidJobs()}
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {importing ? 'Importing...' : 'Import valid jobs'}
              </button>
            </footer>
          </div>
        )}
      </aside>
    </>
  )
}

export default BulkImportDialog
