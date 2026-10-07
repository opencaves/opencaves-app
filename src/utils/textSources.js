import { deleteField } from 'firebase/firestore'

// The Markdown fields that carry a source (textSources.<field>: { source,
// checkedAt }) - the prose; facts (coordinates, depths...) don't.
export const CAVE_TEXT_FIELDS = ['description', 'direction', 'accessDetails', 'accessibilityDetails']
export const SISTEMA_TEXT_FIELDS = ['description', 'direction']

const sourceOf = (entry) => entry?.source || ''

// A record's text sources, as an edit form holds them ({ source: '' } for none).
export function textSourcesOf(record, fields) {
  return Object.fromEntries(fields.map((field) => [field, { source: sourceOf(record?.textSources?.[field]) }]))
}

// A form's text changed: the first edit of the saved words clears the source
// they had (the new words aren't the source's); one picked again stays.
export function withTextChange(form, original, field, value) {
  const firstEdit = `${form[field] ?? ''}` === `${original?.[field] ?? ''}`
  const keptOriginal = sourceOf(form.textSources?.[field]) && sourceOf(form.textSources[field]) === sourceOf(original?.textSources?.[field])
  return { ...form, [field]: value, ...(firstEdit && keptOriginal && { textSources: { ...form.textSources, [field]: { source: '' } } }) }
}

// What a save writes: the entries the form changed - set (with the month
// they were checked) or removed (a text left empty has no source) - or
// undefined when none changed.
export function textSourcesUpdate(original, form, fields) {
  const checkedAt = new Date().toISOString().slice(0, 7)
  const update = {}
  for (const field of fields) {
    const next = `${form[field] ?? ''}`.trim() ? sourceOf(form.textSources?.[field]) : ''
    if (next === sourceOf(original?.textSources?.[field])) continue
    update[field] = next ? { source: next, checkedAt } : deleteField()
  }
  return Object.keys(update).length ? update : undefined
}
