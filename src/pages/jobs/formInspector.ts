// Read-only form inspector. `inspectForm` runs in the employer's page, in his own browser, on a form he already has open
// (as a bookmarklet, see `inspectorBookmarklet`). It lists each field's label, required flag, type, choices, length limit and
// accepted files, and never reads anything typed: no field values, no passwords, no hidden inputs. Nothing is filled, clicked
// or sent. Field discovery follows the idea in job_app_filler (BSD-3, github.com/berellevy/job_app_filler): Workday's
// `formField-` containers plus plain label / fieldset / ARIA semantics for every other board. Written afresh here.
//
// It must stay one self-contained function (no outside names), because the bookmarklet is built from its source text.

export type InspectedField = {
  label: string
  required: boolean
  type: 'text' | 'long_text' | 'choice' | 'multi_choice' | 'file' | 'other'
  options: string[]
  // Set when the list was cut at 40 (a university dropdown can hold thousands): how many there really are.
  optionCount?: number
  maxlength?: number
  accept?: string
}
export type FormSnapshot = { v: 1; page: string; title: string; fields: InspectedField[] }

export const inspectForm = (doc: Document, pageUrl: string): FormSnapshot => {
  const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  // A label's own words: controls, option lists, upload and status widgets nested inside it are not part of the question.
  const NOISE = 'select, textarea, input, option, button, svg, script, style, [aria-hidden="true"], [class*="field" i], [class*="upload" i], [class*="dropdown" i], [class*="loading" i], [class*="error" i], [class*="status" i], [class*="result" i], [class*="tooltip" i]'
  const labelText = (el: Element | null | undefined) => {
    if (!el) return ''
    const copy = el.cloneNode(true) as Element
    for (const noise of [...copy.querySelectorAll(NOISE)]) noise.remove()
    return clean(copy.textContent)
  }
  const hidden = (el: Element) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true
      const style = (node.getAttribute('style') ?? '').replace(/\s+/g, '').toLowerCase()
      if (style.includes('display:none') || style.includes('visibility:hidden')) return true
    }
    return false
  }
  const byId = (id: string) => (id ? doc.getElementById(id) : null)
  const stripMarks = (value: string) => clean(value.replace(/\s*\((?:required|optional)\)\s*/gi, ' ').replace(/[*✱]+/g, ' ').replace(/\brequired\b\s*$/i, ''))
  const idsText = (value: string | null) => (value ?? '').split(/\s+/).filter(Boolean).map((id) => labelText(byId(id))).filter(Boolean).join(' ')

  // The closest label-like element before the control that holds no control itself: Lever's .application-label, a heading, a legend.
  const nearbyLabel = (el: Element): string => {
    let scope = el.parentElement
    for (let depth = 0; scope && depth < 6; depth++, scope = scope.parentElement) {
      const within = scope
      const found = [...scope.querySelectorAll('label, legend, h3, h4, h5, [class*="label" i]')].filter((candidate) => (
        !candidate.contains(el) && !candidate.querySelector('input, select, textarea') && (candidate.compareDocumentPosition(el) & 4) !== 0 && labelText(candidate).length > 1
      ))
      // A label with another question's field between it and this control belongs to that field, not this one.
      const name = el.getAttribute('name')
      const between = (candidate: Element) => [...within.querySelectorAll('input, select, textarea')].some((other) => (
        other !== el && (candidate.compareDocumentPosition(other) & 4) !== 0 && (other.compareDocumentPosition(el) & 4) !== 0
        && !(name && other.getAttribute('name') === name)
      ))
      const last = found.filter((candidate) => !between(candidate)).pop()
      if (last) return labelText(last)
    }
    return ''
  }

  const labelOf = (el: Element): string => {
    const labelledBy = idsText(el.getAttribute('aria-labelledby'))
    if (labelledBy) return labelledBy
    const id = el.getAttribute('id')
    if (id) {
      const forLabel = [...doc.querySelectorAll('label')].find((label) => label.getAttribute('for') === id)
      if (forLabel && labelText(forLabel)) return labelText(forLabel)
    }
    const wrapping = el.closest('label')
    if (wrapping && labelText(wrapping)) return labelText(wrapping)
    const workday = el.closest('[data-automation-id^="formField-"]')
    if (workday) {
      const heading = workday.querySelector('label, h4, legend')
      if (heading && labelText(heading)) return labelText(heading)
    }
    const aria = clean(el.getAttribute('aria-label'))
    if (aria) return aria
    const group = el.closest('fieldset')?.querySelector('legend')
    if (group && labelText(group)) return labelText(group)
    return nearbyLabel(el) || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('name'))
  }

  const groupLabelOf = (el: Element): string => {
    const legend = el.closest('fieldset')?.querySelector('legend')
    if (legend && labelText(legend)) return labelText(legend)
    const group = el.closest('[role="radiogroup"], [role="group"]')
    if (group) {
      const named = clean(group.getAttribute('aria-label')) || idsText(group.getAttribute('aria-labelledby'))
      if (named) return named
    }
    const workday = el.closest('[data-automation-id^="formField-"]')
    const heading = workday?.querySelector('label, h4, legend')
    if (heading && labelText(heading)) return labelText(heading)
    return nearbyLabel(el)
  }

  const isRequired = (el: Element, label: string) => (
    el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
    || /[*✱]\s*$|\(required\)|\brequired\b\s*$/i.test(label)
  )

  const fields: InspectedField[] = []
  const seen = new Set<string>()
  const push = (field: InspectedField) => order.push(field)
  type Group = { label: string; required: boolean; kind: 'radio' | 'checkbox'; options: string[] }
  const groups = new Map<string, Group>()
  // Fields and option groups in page order.
  const order: Array<InspectedField | Group> = []

  for (const el of [...doc.querySelectorAll('input, select, textarea, button[aria-haspopup="listbox"]')]) {
    if (hidden(el)) continue
    const tag = el.tagName.toLowerCase()
    const type = (el.getAttribute('type') ?? 'text').toLowerCase()
    if (tag === 'input' && ['hidden', 'password', 'submit', 'button', 'image', 'reset', 'search'].includes(type)) continue

    if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
      const own = labelText(el.closest('label')) || labelText([...doc.querySelectorAll('label')].find((label) => label.getAttribute('for') === el.getAttribute('id'))) || clean(el.getAttribute('aria-label'))
      const label = stripMarks(groupLabelOf(el))
      const name = el.getAttribute('name') || label
      const key = `${type}:${name}:${label}`
      const known = groups.get(key)
      const group = known ?? { label, required: false, kind: type, options: [] }
      if (!known) order.push(group)
      if (!label) group.label = stripMarks(own)
      else if (own && own !== label) group.options.push(stripMarks(own))
      group.required = group.required || isRequired(el, groupLabelOf(el))
      groups.set(key, group)
      continue
    }

    const raw = labelOf(el)
    const label = stripMarks(raw)
    const required = isRequired(el, raw)
    if (tag === 'select') {
      const all = [...el.querySelectorAll('option')].map((option) => clean(option.textContent)).filter((option) => option && !/^(?:select|choose|please select|--+)\b/i.test(option))
      push({ label, required, type: el.hasAttribute('multiple') ? 'multi_choice' : 'choice', options: all.slice(0, 40), ...(all.length > 40 ? { optionCount: all.length } : {}) })
    } else if (tag === 'textarea') {
      const max = Number(el.getAttribute('maxlength'))
      push({ label, required, type: 'long_text', options: [], ...(max > 0 ? { maxlength: max } : {}) })
    } else if (tag === 'button') {
      push({ label, required, type: 'choice', options: [] })
    } else if (type === 'file') {
      const accept = clean(el.getAttribute('accept'))
      push({ label, required, type: 'file', options: [], ...(accept ? { accept } : {}) })
    } else {
      const max = Number(el.getAttribute('maxlength'))
      push({ label, required, type: type === 'text' || type === 'email' || type === 'tel' || type === 'url' || type === 'number' || type === 'date' ? 'text' : 'other', options: [], ...(max > 0 ? { maxlength: max } : {}) })
    }
  }
  for (const entry of order) {
    const field: InspectedField = 'kind' in entry
      ? { label: entry.label, required: entry.required, type: entry.kind === 'checkbox' && entry.options.length <= 1 ? 'other' : entry.kind === 'checkbox' ? 'multi_choice' : 'choice', options: entry.kind === 'checkbox' && entry.options.length <= 1 ? [] : entry.options }
      : entry
    const key = `${field.label}|${field.type}`
    if (!field.label || seen.has(key) || fields.length >= 150) continue
    seen.add(key)
    fields.push(field)
  }

  let page = pageUrl
  try {
    const url = new URL(pageUrl)
    page = `${url.origin}${url.pathname}`
  } catch {
    // keep what was given
  }
  return { v: 1, page, title: clean(doc.title).slice(0, 200), fields }
}

// The bookmarklet: runs `inspectForm` on the open page and copies the snapshot as JSON. Falls back to a prompt box when the
// browser refuses the clipboard. It touches nothing on the page.
export const inspectorBookmarklet = () => {
  const source = inspectForm.toString()
  const run = `(()=>{const f=(${source});const j=JSON.stringify(f(document,location.href));`
    + `const done=()=>alert('Form copied. Paste it into the dashboard.');`
    + `(navigator.clipboard?navigator.clipboard.writeText(j).then(done,()=>prompt('Copy this, then paste it into the dashboard:',j)):Promise.reject()).catch(()=>prompt('Copy this, then paste it into the dashboard:',j));})()`
  return `javascript:${encodeURIComponent(run)}`
}
