import { useMemo, useState } from 'react'
import { splitSkills, TECH_TERMS } from '../../../supabase/functions/_shared/packet.ts'
import { copyToClipboard } from './prompts'
import { extractRequirements, yearsSummary, type EligibilityKind } from './postingRequirements'
import type { Job } from './types'

const ELIGIBILITY_STYLE: Record<EligibilityKind, { label: string; badge: string }> = {
  no_sponsorship: { label: 'No sponsorship', badge: 'bg-red-100 text-red-800' },
  citizenship: { label: 'Citizenship', badge: 'bg-red-100 text-red-800' },
  clearance: { label: 'Clearance', badge: 'bg-red-100 text-red-800' },
  sponsorship_offered: { label: 'Sponsorship offered', badge: 'bg-emerald-100 text-emerald-800' },
  e_verify: { label: 'E-Verify', badge: 'bg-slate-200 text-slate-700' },
}
const DEGREE_LABEL = { associate: "Associate's", bachelor: "Bachelor's", master: "Master's", phd: 'PhD' } as const

// Step 6.5: what the posting asks for, read with plain rules in the browser (nothing is sent anywhere). The "new terms" are
// for review: nothing here changes the vocabulary the resume checks use.
const PostingRequirementsPanel = ({ job }: { job: Job }) => {
  const [copied, setCopied] = useState(false)
  const found = useMemo(
    () => extractRequirements(job.job_description ?? '', [...TECH_TERMS, ...splitSkills(job.required_skills)], [job.company]),
    [job.job_description, job.required_skills, job.company],
  )
  const years = yearsSummary(found.years)
  if (found.basic.length + found.preferred.length + found.eligibility.length === 0) return null

  return (
    <details className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-slate-900">
        What this posting asks for
        <span className="ml-2 font-normal text-slate-500">
          {[years && `${years} of experience`, found.degrees[0] && `${DEGREE_LABEL[found.degrees[0].level]}${found.degrees[0].orEquivalent ? ' or equivalent' : ''}`, found.certifications.length > 0 && `${found.certifications.length} certification${found.certifications.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
        </span>
      </summary>
      <div className="mt-2 space-y-3 text-slate-700">
        {found.eligibility.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-950">Work authorization wording</h4>
            <ul className="mt-1 space-y-1">
              {found.eligibility.map((entry) => (
                <li key={entry.text}>
                  <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-medium ${ELIGIBILITY_STYLE[entry.kind].badge}`}>{ELIGIBILITY_STYLE[entry.kind].label}</span>
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(found.years.length > 0 || found.degrees.length > 0 || found.certifications.length > 0) && (
          <div>
            <h4 className="font-semibold text-slate-950">Experience, degree, certifications</h4>
            <ul className="mt-1 space-y-1">
              {found.years.map((entry) => <li key={`y:${entry.text}`}><span className="font-medium">Years:</span> {entry.text}</li>)}
              {found.degrees.map((entry) => <li key={`d:${entry.text}`}><span className="font-medium">{DEGREE_LABEL[entry.level]}{entry.orEquivalent ? ', or equivalent experience' : ''}:</span> {entry.text}</li>)}
              {found.certifications.length > 0 && (
                <li><span className="font-medium">Certifications:</span> {found.certifications.map((cert) => `${cert.name} (${cert.kind === 'basic' ? 'required' : 'preferred'})`).join(', ')}</li>
              )}
            </ul>
          </div>
        )}
        {(['basic', 'preferred'] as const).map((kind) => {
          const items = kind === 'basic' ? found.basic : found.preferred
          return items.length > 0 && (
            <details key={kind}>
              <summary className="cursor-pointer font-semibold text-slate-950">{kind === 'basic' ? 'Required' : 'Preferred'} ({items.length})</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item) => <li key={item.text}>{item.text}</li>)}</ul>
            </details>
          )
        })}
        {found.newTerms.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-950">Terms not in your known list</h4>
            <p className="mt-1 flex flex-wrap gap-1">
              {found.newTerms.map((term) => <span key={term} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{term}</span>)}
            </p>
            <p className="mt-1 text-slate-500">A guess at tools and acronyms the resume checks don&apos;t know yet; some will be noise. Nothing is added automatically. If one is a real skill you have, tell Claude to add it.</p>
            <button
              type="button"
              onClick={() => void copyToClipboard(found.newTerms.join(', ')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
              className="mt-1 rounded-md border border-slate-300 px-2.5 py-1 hover:bg-slate-50"
            >
              {copied ? 'Copied' : 'Copy list'}
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500">Read with plain rules from the saved posting text, so check anything that matters against the posting itself.</p>
      </div>
    </details>
  )
}

export default PostingRequirementsPanel
