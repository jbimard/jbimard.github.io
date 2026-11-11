import { useState } from 'react'
import { checkDocxStructure } from './docxStructure'
import { checkExtraction, overall, type Expected, type Finding } from './parseCheck'
import { extractDocxText, extractPdfText } from './parseExtract'

type Result = { label: string; findings: Finding[]; text: string; note: string | null }

const STYLE: Record<Finding['status'], { dot: string; word: string }> = {
  pass: { dot: 'bg-emerald-500', word: 'text-emerald-700' },
  warn: { dot: 'bg-amber-500', word: 'text-amber-700' },
  fail: { dot: 'bg-red-500', word: 'text-red-700' },
}

// Step 6.2: reads the stored PDF and DOCX back like a parser and compares them with the packet. A check of our own files,
// not of any employer's system.
const ParseCheckPanel = ({ docxPath, pdfPath, expected, fileBlob }: {
  docxPath: string
  pdfPath: string | null
  expected: Expected
  fileBlob: (path: string) => Promise<Blob>
}) => {
  const [state, setState] = useState<'idle' | 'running' | 'done' | string>('idle')
  const [results, setResults] = useState<Result[]>([])

  const run = async () => {
    setState('running')
    try {
      const next: Result[] = []
      if (pdfPath) {
        const { text, pages } = await extractPdfText(await fileBlob(pdfPath))
        const findings = checkExtraction(text, expected, pages)
        if (pages.length > 1) findings.push({ id: 'pages', status: 'fail', label: 'One page', detail: `The PDF has ${pages.length} pages.` })
        next.push({ label: 'PDF (PDF.js)', findings, text, note: null })
      }
      const docxBlob = await fileBlob(docxPath)
      const docxText = await extractDocxText(docxBlob)
      next.push({
        label: 'Word (Mammoth)',
        findings: [...checkExtraction(docxText, expected), ...checkDocxStructure(new Uint8Array(await docxBlob.arrayBuffer()))],
        text: docxText,
        note: pdfPath ? null : 'This packet has no PDF copy; regenerate it to check the PDF too.',
      })
      setResults(next)
      setState('done')
    } catch (cause) {
      setState(cause instanceof Error ? cause.message : 'The parse check could not run.')
    }
  }

  return (
    <div className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={state === 'running'} onClick={() => void run()} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
          {state === 'running' ? 'Reading the files…' : state === 'done' ? 'Run the parse check again' : 'Run the parse check'}
        </button>
        <span className="text-slate-500">Reads the stored PDF and Word file back the way a resume parser does. It checks our files, not an employer&apos;s system.</span>
      </div>
      {state !== 'idle' && state !== 'running' && state !== 'done' && <p className="mt-2 text-red-700">{state}</p>}
      {state === 'done' && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {results.map((result) => (
            <div key={result.label}>
              <h4 className="font-semibold text-slate-950">
                {result.label}
                <span className={`ml-2 text-xs font-medium uppercase ${STYLE[overall(result.findings)].word}`}>{overall(result.findings)}</span>
              </h4>
              <ul className="mt-1 space-y-1">
                {result.findings.map((finding) => (
                  <li key={finding.id} className="flex gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STYLE[finding.status].dot}`} aria-hidden />
                    <span><span className="font-medium text-slate-900">{finding.label}.</span> <span className="text-slate-600">{finding.detail}</span></span>
                  </li>
                ))}
              </ul>
              {result.note && <p className="mt-1 text-slate-500">{result.note}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-slate-600">What the parser reads</summary>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{result.text}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ParseCheckPanel
