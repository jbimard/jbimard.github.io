import { useEffect, useRef, useState } from 'react'
import { PacketEditError, type ApplicationPacket, type PacketEdit, type PacketEntry } from './types'

type Flag = ApplicationPacket['check_flags'][number]

type PacketEditorProps = {
  packet: ApplicationPacket
  onSave: (packetId: string, revision: number, edit: PacketEdit) => Promise<{ unchanged?: boolean; changed_lines?: number; voice_saved?: boolean }>
}

type Line = { key: string; label: string; text: string }

const toEdit = (packet: NonNullable<ApplicationPacket['packet']>): PacketEdit => ({
  summary: packet.summary.text,
  experience: structuredClone(packet.experience),
  projects: structuredClone(packet.projects),
  cover_letter: [...packet.cover_letter.paragraphs],
  answers: { ...packet.answers },
})

const QUESTIONS: Record<string, string> = {
  why_company: 'Why this company?',
  why_role: 'Why this role?',
  relevant_project: 'Most relevant project',
  anything_else: 'Anything else',
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

const speak = (text: string, onEnd?: () => void) => {
  if (!canSpeak) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  if (onEnd) utterance.onend = onEnd
  window.speechSynthesis.speak(utterance)
}

// Edit tab (step 3c-B): change any line's wording, drop or reorder bullets, and read the packet aloud line by line.
// Saving goes through packet-edit, which runs the same truth check as the routine and re-renders the .docx files.
const PacketEditor = ({ packet, onSave }: PacketEditorProps) => {
  const stored = packet.packet!
  const [edit, setEdit] = useState<PacketEdit>(() => toEdit(stored))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<PacketEditError | null>(null)
  const [reading, setReading] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const fields = useRef(new Map<string, HTMLTextAreaElement>())

  useEffect(() => () => {
    if (canSpeak) window.speechSynthesis.cancel()
  }, [])

  // Stored flags point at stored positions; bullets are matched by the base bullet they reword, so they follow a reorder.
  const flagsByKey = new Map<string, Flag[]>()
  const addFlag = (key: string, flag: Flag) => flagsByKey.set(key, [...(flagsByKey.get(key) ?? []), flag])
  const flagKey = (path: string, packetBullets: { experience: PacketEntry[]; projects: PacketEntry[] }) => {
    const bullet = path.match(/^(experience|projects)\[(\d+)\]\.bullets\[(\d+)\]$/)
    if (bullet) {
      const from = packetBullets[bullet[1] as 'experience' | 'projects'][Number(bullet[2])]?.bullets[Number(bullet[3])]?.from
      return from ? `bullet:${from}` : null
    }
    const paragraph = path.match(/^cover_letter\.paragraphs\[(\d+)\]$/)
    if (paragraph) return `letter:${paragraph[1]}`
    if (path.startsWith('answers.')) return `answer:${path.slice(8)}`
    return path === 'summary' ? 'summary' : null
  }
  for (const flag of packet.check_flags) {
    const key = flagKey(flag.path, stored)
    if (key) addFlag(key, flag)
  }
  // A refused save's red flags and errors point at the edited positions.
  const refusedByKey = new Map<string, string[]>()
  const general: string[] = []
  if (refusal) {
    for (const flag of refusal.flags) {
      const key = flagKey(flag.path, edit)
      if (key) refusedByKey.set(key, [...(refusedByKey.get(key) ?? []), flag.message])
      else general.push(flag.message)
    }
    for (const error of refusal.errors) {
      const path = error.match(/^([a-z_]+(?:\[\d+\])?(?:\.[a-z_]+(?:\[\d+\])?)*)/)?.[1] ?? ''
      const key = flagKey(path.replace(/\.text$/, ''), edit)
      if (key) refusedByKey.set(key, [...(refusedByKey.get(key) ?? []), error])
      else general.push(error)
    }
  }

  const sources = new Map([...packet.resume_content.experience, ...packet.resume_content.projects].flatMap((entry) => entry.sources.map((source) => [source.id, source.text] as const)))
  const storedText = new Map([...stored.experience, ...stored.projects].flatMap((entry) => entry.bullets.map((bullet) => [bullet.from, bullet.text] as const)))

  const lines: Line[] = [
    { key: 'summary', label: 'Summary', text: edit.summary },
    ...(['experience', 'projects'] as const).flatMap((kind) => edit[kind].flatMap((entry, i) => entry.bullets.map((bullet) => ({
      key: `bullet:${bullet.from}`,
      label: packet.resume_content[kind][i]?.heading ?? kind,
      text: bullet.text,
    })))),
    ...edit.cover_letter.map((text, i) => ({ key: `letter:${i}`, label: `Cover letter, paragraph ${i + 1}`, text })),
    ...Object.entries(edit.answers).filter(([, text]) => text.trim()).map(([key, text]) => ({ key: `answer:${key}`, label: QUESTIONS[key] ?? key, text })),
  ]
  const dirty = JSON.stringify(edit) !== JSON.stringify(toEdit(stored))

  const update = (change: (draft: PacketEdit) => void) => {
    setEdit((current) => {
      const draft = structuredClone(current)
      change(draft)
      return draft
    })
    setNotice(null)
  }

  const moveBullet = (kind: 'experience' | 'projects', entry: number, from: number, to: number) => update((draft) => {
    const bullets = draft[kind][entry].bullets
    const [moved] = bullets.splice(from, 1)
    bullets.splice(to, 0, moved)
  })

  const restoreBullet = (kind: 'experience' | 'projects', entry: number, from: string) => update((draft) => {
    const order = stored[kind][entry].bullets.map((bullet) => bullet.from)
    const bullets = draft[kind][entry].bullets
    const at = bullets.findIndex((bullet) => order.indexOf(bullet.from) > order.indexOf(from))
    bullets.splice(at === -1 ? bullets.length : at, 0, { from, text: storedText.get(from) ?? '' })
  })

  // Read-through: speak a line, then wait for "Sounds like me" or "Edit this line".
  const readLine = (index: number) => {
    const line = lines[index]
    if (!line) {
      setReading(null)
      setNotice('Read-through finished.')
      return
    }
    setReading(index)
    fields.current.get(line.key)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setSpeaking(true)
    speak(line.text, () => setSpeaking(false))
  }
  const stopReading = () => {
    if (canSpeak) window.speechSynthesis.cancel()
    setSpeaking(false)
    setReading(null)
  }
  const editCurrent = () => {
    const line = reading === null ? null : lines[reading]
    stopReading()
    if (line) fields.current.get(line.key)?.focus()
  }

  const save = async () => {
    stopReading()
    setBusy(true)
    setRefusal(null)
    setNotice(null)
    try {
      const result = await onSave(packet.id, packet.revision, edit)
      if (result.unchanged) setNotice('Nothing changed.')
      else setNotice(`Saved: ${result.changed_lines ?? 0} line(s) changed, files rendered again.${result.voice_saved === false ? ' Your edits could not be kept as voice examples this time.' : ''}`)
    } catch (saveError) {
      setRefusal(saveError instanceof PacketEditError ? saveError : new PacketEditError(saveError instanceof Error ? saveError.message : 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }

  const field = (line: Line, value: string, onChange: (value: string) => void, source?: string) => {
    const active = reading !== null && lines[reading]?.key === line.key
    const flags = flagsByKey.get(line.key) ?? []
    const refused = refusedByKey.get(line.key) ?? []
    return (
      <div className={`rounded border p-2 ${active ? 'border-sky-400 bg-sky-50' : refused.length ? 'border-red-300' : 'border-slate-200'}`}>
        <textarea
          ref={(element) => {
            if (element) fields.current.set(line.key, element)
            else fields.current.delete(line.key)
          }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={Math.max(2, Math.ceil(value.length / 90))}
          className="w-full resize-y rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {canSpeak && (
            <button type="button" onClick={() => speak(value)} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Listen</button>
          )}
          {source !== undefined && <span className="text-slate-500">Base: {source}</span>}
        </div>
        {refused.map((message, i) => <p key={`r${i}`} className="mt-1 text-xs text-red-700">{message}</p>)}
        {flags.map((flag) => (
          <p key={flag.id} className={`mt-1 text-xs ${flag.severity === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{flag.message}</p>
        ))}
      </div>
    )
  }

  const lineFor = (key: string) => lines.find((line) => line.key === key) ?? { key, label: '', text: '' }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-1 py-2">
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy ? 'Checking…' : 'Save and re-check'}
        </button>
        <button type="button" disabled={!dirty || busy} onClick={() => { setEdit(toEdit(stored)); setRefusal(null) }} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400">Undo all</button>
        {canSpeak && reading === null && (
          <button type="button" onClick={() => readLine(0)} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Read aloud</button>
        )}
        {reading !== null && (
          <>
            <span className="text-sm text-slate-600">{reading + 1} / {lines.length}{speaking ? ' · reading…' : ''}</span>
            <button type="button" onClick={() => readLine(reading + 1)} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800">Sounds like me</button>
            <button type="button" onClick={editCurrent} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Edit this line</button>
            <button type="button" onClick={() => speak(lines[reading].text, () => setSpeaking(false))} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Repeat</button>
            <button type="button" onClick={stopReading} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Stop</button>
          </>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Every save runs the same truth check as the preparation routine. Errors and red flags are refused and nothing changes; yellow flags are saved for you to review.
        {packet.approved_at && ' Saving clears the approval, so approve the new version again.'}
        {' '}Changed lines are kept as examples of your writing for future packets.
      </p>
      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {refusal && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">{refusal.message}</p>
          {general.map((message, i) => <p key={i} className="mt-1 text-xs">{message}</p>)}
          {(refusal.errors.length > 0 || refusal.flags.length > 0) && <p className="mt-1 text-xs">The lines with problems are outlined in red below.</p>}
        </div>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-950">Summary</h3>
        {field(lineFor('summary'), edit.summary, (value) => update((draft) => { draft.summary = value }))}
      </section>

      {(['experience', 'projects'] as const).map((kind) => edit[kind].length > 0 && (
        <section key={kind}>
          <h3 className="mb-2 text-sm font-semibold text-slate-950">{kind === 'experience' ? 'Experience' : 'Projects'}</h3>
          <div className="flex flex-col gap-4">
            {edit[kind].map((entry, i) => {
              const heading = packet.resume_content[kind][i]
              const removed = stored[kind][i].bullets.filter((bullet) => !entry.bullets.some((kept) => kept.from === bullet.from))
              return (
                <div key={entry.id}>
                  <p className="mb-1 text-sm font-medium text-slate-800">{heading?.heading}{heading?.subheading ? ` · ${heading.subheading}` : ''}</p>
                  <div className="flex flex-col gap-2">
                    {entry.bullets.map((bullet, j) => (
                      <div key={bullet.from} className="flex gap-2">
                        <div className="flex flex-col gap-1 pt-2 text-xs">
                          <button type="button" aria-label="Move up" disabled={j === 0} onClick={() => moveBullet(kind, i, j, j - 1)} className="rounded border border-slate-300 px-1.5 hover:bg-slate-50 disabled:text-slate-300">↑</button>
                          <button type="button" aria-label="Move down" disabled={j === entry.bullets.length - 1} onClick={() => moveBullet(kind, i, j, j + 1)} className="rounded border border-slate-300 px-1.5 hover:bg-slate-50 disabled:text-slate-300">↓</button>
                          <button type="button" aria-label="Remove bullet" disabled={entry.bullets.length === 1} onClick={() => update((draft) => { draft[kind][i].bullets.splice(j, 1) })} className="rounded border border-slate-300 px-1.5 hover:bg-red-50 disabled:text-slate-300">✕</button>
                        </div>
                        <div className="flex-1">
                          {field(lineFor(`bullet:${bullet.from}`), bullet.text, (value) => update((draft) => { draft[kind][i].bullets[j].text = value }), sources.get(bullet.from) ?? '')}
                        </div>
                      </div>
                    ))}
                    {removed.map((bullet) => (
                      <p key={bullet.from} className="flex items-start gap-2 text-xs text-slate-500">
                        <button type="button" onClick={() => restoreBullet(kind, i, bullet.from)} className="shrink-0 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Restore</button>
                        <span className="line-through">{bullet.text}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-950">Cover letter</h3>
        <div className="flex flex-col gap-2">
          {edit.cover_letter.map((paragraph, i) => (
            <div key={i}>{field(lineFor(`letter:${i}`), paragraph, (value) => update((draft) => { draft.cover_letter[i] = value }))}</div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-950">Application answers</h3>
        <div className="flex flex-col gap-3">
          {Object.keys(edit.answers).map((key) => (
            <div key={key}>
              <p className="mb-1 text-sm font-medium text-slate-800">{QUESTIONS[key] ?? key}</p>
              {field(lineFor(`answer:${key}`), edit.answers[key], (value) => update((draft) => { draft.answers[key] = value }))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PacketEditor
