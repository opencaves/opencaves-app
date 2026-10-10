import { deleteField } from 'firebase/firestore'

/**
 * A form field's value for a merge save (firestoreCollectionModel's save):
 * an empty one - '', whitespace only, null, undefined or an empty list -
 * removes the stored field ({@link deleteField}()), since merge leaves a field left
 * out as it was, and emptying a field in a form must clear it.
 */
export function orDelete(value) {
  const empty = value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
  return empty ? deleteField() : value
}
