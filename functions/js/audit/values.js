import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore'

/**
 * Firestore values compared by content: Timestamps, GeoPoints and references
 * by their own isEqual (JSON.stringify would tell two equal ones apart, or
 * two different ones not), arrays in order, maps whatever their key order.
 * `undefined` stands for an absent field.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function isEqualValue(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  for (const Type of [Timestamp, GeoPoint, DocumentReference]) {
    if (a instanceof Type || b instanceof Type) return a instanceof Type && b instanceof Type && a.isEqual(b)
  }
  if (Buffer.isBuffer(a) || Buffer.isBuffer(b)) return Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b)
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => isEqualValue(item, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && isEqualValue(a[key], b[key]))
  }
  return Number.isNaN(a) && Number.isNaN(b)
}

/**
 * The fields whose values differ between two versions of a document.
 *
 * @param {object} before
 * @param {object} after
 * @returns {string[]}
 */
export function changedFields(before, after) {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...fields].filter((field) => !isEqualValue(before[field], after[field]))
}

/**
 * { field: value } for those of `fields` present in `data`: a field left out
 * was absent.
 *
 * @param {object} data
 * @param {string[]} fields
 * @returns {object}
 */
export function pickFields(data, fields) {
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(data, field)).map((field) => [field, data[field]]))
}

/**
 * A value as plain JSON, for a callable's response: a Timestamp as an ISO
 * date, a {@link GeoPoint} as { latitude, longitude }, a reference as its path,
 * an absent field as null.
 *
 * @param {*} value
 * @returns {*}
 */
export function toPlain(value) {
  if (value === undefined || value === null) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude }
  if (value instanceof DocumentReference) return value.path
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (Array.isArray(value)) return value.map(toPlain)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item)]))
  return value
}
