import { useState } from 'react'
import type { ApplicationForm } from './applicationForm'
import FormQuestionList from './FormQuestionList'
import { inspectorBookmarklet } from './formInspector'
import { importFormSnapshot } from './formSnapshot'
import { copyToClipboard } from './prompts'

// For boards that don't publish their questions (Workday, iCIMS, Lever, Ashby, ...): a bookmarklet he runs himself on the
// application page he already has open reads the fields (labels, required, choices, limits; never anything typed) and copies
// them; he pastes the result here. Nothing is fetched from the employer, filled or submitted.
const FormInspectorBox = ({ form, onForm }: { form: ApplicationForm | null; onForm: (form: ApplicationForm | null) => void }) => {
  const [open, setOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)

  const use = () => {
    try {
      const imported = importFormSnapshot(pasted)
      onForm(imported.form)
      setSource(imported.title || imported.page)
      setPasted('')
      setMessage(null)
      setOpen(false)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not read that.')
    }
  }

  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-white px-3 py-2">
      {form && (
        <>
          <FormQuestionList form={form} />
          {source && <p className="mt-1 text-slate-500">Read from: {source}</p>}
        </>
      )}
      <div className={form ? 'mt-2 flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
          {form ? 'Read the form again' : 'Read the form from the page'}
        </button>
        {form && <button type="button" onClick={() => { onForm(null); setSource(null) }} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">Clear</button>}
      </div>
      {open && (
        <div className="mt-2 space-y-2 text-slate-700">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <button
                type="button"
                onClick={() => void copyToClipboard(inspectorBookmarklet()).then(() => setMessage('Copied. Make a new bookmark and paste this as its address.'), () => setMessage('Copy failed. Allow clipboard access and try again.'))}
                className="rounded-md bg-slate-950 px-2.5 py-1 text-white hover:bg-slate-800"
              >
                Copy the form reader
              </button>
              {' '}once, then save it as a bookmark called &quot;Read form&quot; (new bookmark, paste as the address).
            </li>
            <li>Open the application page, sign in if it asks, then click the bookmark. It copies the field list.</li>
            <li>Paste it here and press Use.</li>
          </ol>
          <p className="text-slate-500">It reads labels, required marks, choices, length limits and accepted file types. It never reads what is typed, passwords or hidden fields, and it changes nothing on the page.</p>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={3}
            placeholder="Paste what the form reader copied"
            className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
          />
          <button type="button" disabled={!pasted.trim()} onClick={use} className="rounded-md border border-emerald-700 px-3 py-1.5 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Use</button>
        </div>
      )}
      {message && <p className="mt-1 text-slate-600">{message}</p>}
    </div>
  )
}

export default FormInspectorBox
