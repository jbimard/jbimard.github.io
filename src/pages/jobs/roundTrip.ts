// Round trip: how much of what the packet says survives extraction, and in what order. Modelled on the round-trip scoring
// in Resume Matcher (Apache-2.0, github.com/srbhr/Resume-Matcher/.../ats_parse/roundtrip.py), written afresh here.
// Word-level recall per field (each extracted word is used by one field only), then order fidelity as a rank correlation.
import type { Expected } from './parseCheck.ts'

export const FOUND = 0.9
export const GARBLED = 0.5

export type RoundTripField = { label: string; text: string; score: number; status: 'found' | 'garbled' | 'missing' }
export type RoundTrip = { recall: number; orderFidelity: number; fields: RoundTripField[] }

const words = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []

const fields = (expected: Expected) => [
  ...(expected.summary ? [{ label: 'Summary', text: expected.summary }] : []),
  ...expected.entries.flatMap((entry) => [
    { label: entry.heading, text: entry.heading },
    ...(entry.right ? [{ label: `${entry.heading} dates`, text: entry.right }] : []),
    ...entry.bullets.map((bullet) => ({ label: bullet, text: bullet })),
  ]),
].filter((field) => words(field.text).length > 0)

export const roundTrip = (extracted: string, expected: Expected): RoundTrip => {
  const pool = new Map<string, number>()
  for (const word of words(extracted)) pool.set(word, (pool.get(word) ?? 0) + 1)

  let totalWords = 0
  let foundWords = 0
  const scored = fields(expected).map((field) => {
    const tokens = words(field.text)
    let hit = 0
    for (const token of tokens) {
      const left = pool.get(token) ?? 0
      if (left > 0) {
        pool.set(token, left - 1)
        hit++
      }
    }
    totalWords += tokens.length
    foundWords += hit
    const score = hit / tokens.length
    return { ...field, score, status: score >= FOUND ? 'found' as const : score >= GARBLED ? 'garbled' as const : 'missing' as const }
  })

  // Where each field starts in the extraction (its first six words), for the order comparison.
  const stream = words(extracted)
  const starts = scored.map((field) => {
    if (field.status === 'missing') return -1
    const head = words(field.text).slice(0, 6)
    for (let at = 0; at + head.length <= stream.length; at++) if (head.every((word, i) => stream[at + i] === word)) return at
    return -1
  })
  let concordant = 0
  let discordant = 0
  for (let i = 0; i < starts.length; i++) {
    for (let j = i + 1; j < starts.length; j++) {
      if (starts[i] < 0 || starts[j] < 0) continue
      if (starts[i] < starts[j]) concordant++
      else discordant++
    }
  }
  const pairs = concordant + discordant
  return {
    recall: totalWords === 0 ? 1 : foundWords / totalWords,
    orderFidelity: pairs === 0 ? 1 : (concordant - discordant) / pairs / 2 + 0.5,
    fields: scored.map(({ label, text, score, status }) => ({ label, text, score, status })),
  }
}
