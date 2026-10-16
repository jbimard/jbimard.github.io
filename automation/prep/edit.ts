// Packet edits from the dashboard (step 3c-B). An edit may change the wording of any line (bullets, summary, cover
// letter paragraphs, answers), and remove or reorder bullets within an entry. It can't add bullets or entries, change
// which base bullet a line rewords, or touch skills, coursework, the version or the match report: those stay as stored.
// Qualifications that cited a removed bullet drop it, and one left with no evidence is no longer counted as met.
// The merged packet then goes through validatePacket and checkPacket like one from the routine.
// supabase/functions/_shared/edit.ts must stay an exact copy of this file (edit.test.ts checks).
import { ANSWER_KEYS, RESUME_VERSIONS, type BaseResumes, type Packet, type PacketEntry } from './packet.ts'

export type PacketEdit = {
  summary: string
  experience: PacketEntry[]
  projects: PacketEntry[]
  cover_letter: string[]
  answers: Record<(typeof ANSWER_KEYS)[number], string>
}
// One changed line, kept as a voice example: what he wrote instead of what was generated.
export type EditChange = {
  kind: 'bullet' | 'bullet_removed' | 'summary' | 'cover_letter' | 'answer'
  path: string
  source: string | null
  before: string
  after: string | null
}

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)

const baseBullet = (base: BaseResumes, id: string) => {
  for (const version of RESUME_VERSIONS) {
    for (const entry of [...base.versions[version].experience, ...base.versions[version].projects]) {
      const bullet = entry.bullets.find((item) => item.id === id)
      if (bullet) return bullet.text
    }
  }
  return null
}

export const applyEdit = (stored: Packet, input: unknown, base: BaseResumes): { packet: Packet | null; errors: string[]; changes: EditChange[] } => {
  const errors: string[] = []
  const changes: EditChange[] = []
  if (!isObj(input)) return { packet: null, errors: ['The edit must be an object.'], changes }
  const text = (path: string, value: unknown) => {
    if (typeof value !== 'string') errors.push(`${path} must be a string.`)
    return typeof value === 'string' ? value.trim() : ''
  }
  const changed = (kind: EditChange['kind'], path: string, before: string, after: string, source: string | null = null) => {
    if (before.trim() !== after) changes.push({ kind, path, source, before, after })
  }

  const summary = text('summary', input.summary)
  changed('summary', 'summary', stored.summary.text, summary)

  const entries = (kind: 'experience' | 'projects'): PacketEntry[] => {
    const original = stored[kind]
    const edited = input[kind]
    if (!Array.isArray(edited) || edited.length !== original.length) {
      errors.push(`${kind} must keep its ${original.length} entries; add or drop entries with Regenerate.`)
      return original
    }
    return original.map((entry, i) => {
      const path = `${kind}[${i}]`
      const next = edited[i]
      if (!isObj(next) || next.id !== entry.id || !Array.isArray(next.bullets)) {
        errors.push(`${path} must be { id: "${entry.id}", bullets }; entries can't be swapped.`)
        return entry
      }
      const before = new Map(entry.bullets.map((bullet) => [bullet.from, bullet.text]))
      const seen = new Set<string>()
      const bullets = next.bullets.flatMap((bullet, j) => {
        const from = isObj(bullet) ? bullet.from : undefined
        if (typeof from !== 'string' || !before.has(from)) {
          errors.push(`${path}.bullets[${j}] must keep one of this entry's bullets; new ones come from Regenerate.`)
          return []
        }
        if (seen.has(from)) {
          errors.push(`${path}.bullets[${j}] repeats a bullet.`)
          return []
        }
        seen.add(from)
        const value = text(`${path}.bullets[${j}].text`, (bullet as Obj).text)
        changed('bullet', `${path}.bullets[${j}]`, before.get(from)!, value, baseBullet(base, from))
        return [{ from, text: value }]
      })
      if (bullets.length === 0) errors.push(`${path} needs at least one bullet.`)
      for (const [from, removed] of before) {
        if (!seen.has(from)) changes.push({ kind: 'bullet_removed', path, source: baseBullet(base, from), before: removed, after: null })
      }
      return { id: entry.id, bullets }
    })
  }
  const experience = entries('experience')
  const projects = entries('projects')

  const letter = input.cover_letter
  let paragraphs = stored.cover_letter.paragraphs
  if (!Array.isArray(letter) || letter.length !== paragraphs.length) {
    errors.push(`cover_letter must keep its ${paragraphs.length} paragraphs.`)
  } else {
    paragraphs = letter.map((paragraph, i) => {
      const value = text(`cover_letter.paragraphs[${i}]`, paragraph)
      changed('cover_letter', `cover_letter.paragraphs[${i}]`, stored.cover_letter.paragraphs[i], value)
      return value
    })
  }

  const answers = { ...stored.answers }
  if (!isObj(input.answers)) {
    errors.push('answers must be an object.')
  } else {
    for (const key of ANSWER_KEYS) {
      const value = text(`answers.${key}`, input.answers[key])
      changed('answer', `answers.${key}`, stored.answers[key], value)
      answers[key] = value
    }
  }

  if (errors.length) return { packet: null, errors, changes: [] }
  const kept = new Set([...experience, ...projects].flatMap((entry) => entry.bullets.map((bullet) => bullet.from)))
  const removed = new Set([...stored.experience, ...stored.projects].flatMap((entry) => entry.bullets.map((bullet) => bullet.from)).filter((from) => !kept.has(from)))
  const qualifications = stored.qualifications?.map((item) => {
    const evidence = item.evidence.filter((ref) => !removed.has(ref))
    if (evidence.length === item.evidence.length) return item
    const unmet = item.met && evidence.length === 0
    return { ...item, evidence, met: unmet ? false : item.met, note: unmet ? 'Its evidence was removed in an edit.' : item.note }
  })
  return {
    packet: { ...stored, summary: { text: summary }, experience, projects, cover_letter: { paragraphs }, answers, ...(qualifications ? { qualifications } : {}) },
    errors,
    changes,
  }
}
