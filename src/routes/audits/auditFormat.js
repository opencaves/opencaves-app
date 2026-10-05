import { GeoPoint, Timestamp } from 'firebase/firestore'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'

// Formatting the audit log's entries and the trash's items for the Audits
// page, in the reader's language.

// A Firestore Timestamp (or anything with toDate()) as a Date.
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return null
}

export function formatFullDate(date, language) {
  return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : ''
}

const RELATIVE_UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

// "5 minutes ago", "yesterday"…
export function formatRelative(date, language, now = Date.now()) {
  if (!date) return ''
  const seconds = Math.round((date.getTime() - now) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') {
      return format.format(Math.round(seconds / size), unit)
    }
  }
  return ''
}

// A value of a record, for display: { absent: true } when the field wasn't
// there, else its text and whether it's code-like (JSON) or plain text.
export function formatValue(value, language) {
  if (value === undefined) return { absent: true }
  if (value === null) return { text: 'null', code: true }
  if (typeof value === 'string') return { text: value }
  if (typeof value === 'number' || typeof value === 'boolean') return { text: String(value), code: true }
  if (value instanceof Timestamp) return { text: formatFullDate(value.toDate(), language) }
  if (value instanceof GeoPoint) return { text: `${value.latitude}, ${value.longitude}`, code: true }
  return { text: JSON.stringify(value, jsonReplacer, 2), code: true }
}

// Inside objects, Timestamps as ISO dates and GeoPoints as their coordinates
// (their own toJSON is less readable) - read from the holder, before toJSON.
function jsonReplacer(key, value) {
  const raw = this[key]
  if (raw instanceof Timestamp) return raw.toDate().toISOString()
  if (raw instanceof GeoPoint) return { latitude: raw.latitude, longitude: raw.longitude }
  return value
}

// A value shown as a compact chip (old -> new) rather than through the line
// diff: nothing, a number, a flag, a date, a point, or a short one-line text.
export function isCompactValue(value) {
  if (value === undefined || value === null || typeof value === 'number' || typeof value === 'boolean') return true
  if (value instanceof Timestamp || value instanceof GeoPoint) return true
  return typeof value === 'string' && value.length <= 80 && !value.includes('\n')
}

// A value as the text the line diff compares: a text as is, anything else as
// formatValue shows it (objects as pretty JSON); nothing as no lines.
export function toDiffText(value, language) {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return formatValue(value, language).text
}

// A record's name: its name field (a string, or { value }).
export function nameOf(record) {
  const name = record?.name
  if (typeof name === 'string') return name
  if (typeof name?.value === 'string') return name.value
  return ''
}

// Where a record is seen or edited in the app, from what it is now (null:
// gone). The trash's photos and maps lead to the Trash tab.
export function recordPath(collectionName, id, record) {
  if (!record) return null
  if (collectionName === 'cavesAssets' || collectionName === 'maps') {
    if (record.deletedAt != null) return '/audits?tab=trash'
    return collectionName === 'cavesAssets' && record.caveId ? `/map/${record.caveId}/medias/${id}` : null
  }
  if (collectionName === 'caves') return `/map/${id}`
  if (collectionName === 'sistemas') return `/sistemas/${id}/edit`
  if (collectionName === 'connections') return `/connections/${id}/edit`
  if (REFERENCE_DATA_CONFIGS[collectionName]) return `/${collectionName}/${id}/edit`
  return null
}

// The collections whose records have a page to link to.
export function hasRecordPage(collectionName) {
  return ['caves', 'sistemas', 'connections', 'cavesAssets', 'maps'].includes(collectionName) || Boolean(REFERENCE_DATA_CONFIGS[collectionName])
}

// The fields an entry shows, sorted: the changed ones for an update, every
// field of the record for a creation or deletion.
export function entryFields(entry) {
  if (Array.isArray(entry.changedFields) && entry.changedFields.length > 0) return [...entry.changedFields].sort()
  return [...new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])].sort()
}
