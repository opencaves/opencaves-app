import { deleteField } from 'firebase/firestore'
import { OPEN_CAVES_SOURCE_ID } from '@/config/app.js'

// The Markdown fields that carry a source (textSources.<field>: { source,
// checkedAt }) - the prose; facts (coordinates, depths...) don't.
export const CAVE_TEXT_FIELDS = ['description', 'direction', 'accessDetails', 'accessibilityDetails']
export const SISTEMA_TEXT_FIELDS = ['description', 'direction']

const sourceOf = (entry) => entry?.source || ''

/**
 * A record's text sources, as an edit form holds them ({ source: '' } for none).
 *
 * @param {object} record
 * @param {string[]} fields
 * @returns {object}
 */
export function textSourcesOf(record, fields) {
  return Object.fromEntries(fields.map((field) => [field, { source: sourceOf(record?.textSources?.[field]) }]))
}

/**
 * A form's text changed. Edited, the words are the app's: their source becomes
 * OpenCaves - unless the editor picked one since. Back to the saved words
 * (undone, retyped), they get their saved source back.
 *
 * @param {object} form
 * @param {object} original - The saved record.
 * @param {string} field
 * @param {*} value
 * @returns {object} The form.
 */
export function withTextChange(form, original, field, value) {
  const saved = `${original?.[field] ?? ''}`
  const savedSource = sourceOf(original?.textSources?.[field])
  const current = sourceOf(form.textSources?.[field])
  // Still the source the form started with, or OpenCaves set by an earlier edit: not the editor's pick.
  const automatic = current === savedSource || current === OPEN_CAVES_SOURCE_ID
  let source = current
  if (`${value}` === saved) source = automatic ? savedSource : current
  else if (automatic) source = OPEN_CAVES_SOURCE_ID
  return { ...form, [field]: value, ...(source !== current && { textSources: { ...form.textSources, [field]: { source } } }) }
}

/**
 * What a save writes: the entries the form changed - set (with the month
 * they were checked) or removed (a text left empty has no source) - or
 * undefined when none changed.
 *
 * @param {object} original
 * @param {object} form
 * @param {string[]} fields
 * @returns {object|undefined}
 */
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
