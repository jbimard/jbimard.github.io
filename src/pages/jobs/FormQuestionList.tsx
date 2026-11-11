import type { ApplicationForm } from './applicationForm'

// The custom questions of a form read from the employer's page (Greenhouse's public API, or the form reader's snapshot).
const FormQuestionList = ({ form }: { form: ApplicationForm }) => (
  form.questions.length === 0 ? (
    <p>No custom questions. Only the standard fields ({form.standardCount}).</p>
  ) : (
    <>
      <p className="font-medium text-slate-950">{form.questions.length} custom question{form.questions.length === 1 ? '' : 's'} (added to the copied instructions)</p>
      <ul className="mt-1 space-y-1">
        {form.questions.map((question, i) => (
          <li key={`${i}:${question.label}`}>
            {question.eligibility && <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">eligibility</span>}
            {question.label}
            <span className="text-slate-500">
              {' '}· {question.required ? 'required' : 'optional'} · {question.kind.replace('_', ' ')}
              {question.maxlength ? ` · max ${question.maxlength}` : ''}{question.accept ? ` · ${question.accept}` : ''}
              {question.options.length > 0 ? ` · ${question.options.slice(0, 8).join(' / ')}${(question.optionCount ?? question.options.length) > 8 ? ` (+${(question.optionCount ?? question.options.length) - 8} more)` : ''}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {form.deadline && <p className="mt-1 text-slate-600">Deadline on the form: {form.deadline}</p>}
    </>
  )
)

export default FormQuestionList
