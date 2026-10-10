import { useMemo } from 'react'
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'
import { auth, db } from '@/config/firebase.js'
import { isTrashed } from '@/utils/trash.js'

const converter = {
  toFirestore: (data) => data,
  fromFirestore: (snapshot, options) => ({ id: snapshot.id, ...snapshot.data(options) })
}

/**
 * Shared read/write access for the plain-object cave-data collections
 * (caves, sistemas, connections, and the reference-data collections). Mirrors
 * the converter + useCollection pattern established in models/CaveAsset.js,
 * the only other Firestore data-access precedent in this app, generalized
 * since these collections don't need per-entity classes/behavior.
 *
 * @param {string} collectionName
 * @param {object} [options]
 * @param {boolean} [options.trash=false] - The collection's deletions go to the trash (utils/trash.js) - its
 *   reads then skip the records in it (useAll({ includeTrashed: true }) keeps
 *   them, for a reader that must tell a trashed record from a missing one).
 * @returns {object}
 */
export function createCollectionModel(collectionName, { trash = false } = {}) {
  const collectionRef = collection(db, collectionName).withConverter(converter)
  const visible = (item) => !trash || !isTrashed(item)

  return {
    collectionName,
    collectionRef,

    async getAll() {
      const snapshot = await getDocs(collectionRef)
      return snapshot.docs.map(d => d.data()).filter(visible)
    },

    async getById(id) {
      const snapshot = await getDoc(doc(db, collectionName, id).withConverter(converter))
      return snapshot.exists() && visible(snapshot.data()) ? snapshot.data() : null
    },

    // Merges `fields` into the doc at `id` (creating it if absent), leaving
    // any field not present in `fields` untouched - so a form that only
    // exposes a subset of a record's fields can't accidentally wipe out the
    // rest. Unlike the Admin SDK, the client SDK rejects `undefined` values
    // outright rather than treating them as "field not present", so callers
    // building their fields object with `value || undefined` (for optional
    // form inputs left blank) need those stripped before writing.
    async save(id, fields) {
      const definedFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined)
      )
      await setDoc(doc(db, collectionName, id), definedFields, { merge: true })
    },

    async remove(id) {
      await deleteDoc(doc(db, collectionName, id))
    },

    // To the trash (admins): kept, with who moved it there and when, until
    // it's restored or deleted for good (Audits > Trash).
    async moveToTrash(id) {
      await updateDoc(doc(db, collectionName, id), { deletedAt: serverTimestamp(), deletedBy: auth.currentUser?.uid ?? null })
    },

    async restore(id) {
      await updateDoc(doc(db, collectionName, id), { deletedAt: deleteField(), deletedBy: deleteField() })
    },

    // The records in the trash, most recently deleted first.
    async getTrashed() {
      const snapshot = await getDocs(query(collectionRef, where('deletedAt', '!=', null), orderBy('deletedAt', 'desc')))
      return snapshot.docs.map(d => d.data())
    },

    useAll({ includeTrashed = false } = {}) {
      // On a page the server rendered: the server's (ssrContext.js), by the
      // collection's name.
      const [snapshot, loading, error] = useSsrCollection(collectionName, collectionRef)
      const items = useMemo(() => snapshot?.docs.map(d => d.data()).filter((item) => includeTrashed || visible(item)) || [], [snapshot, includeTrashed])
      return [items, loading, error]
    }
  }
}
