import { useMemo } from 'react'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'
import { loadFirebase } from '@/utils/loadFirebase.js'
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
 * since these collections don't need per-entity classes/behavior. Firebase
 * is loaded by the first read or write (utils/loadFirebase.js), not with the
 * model.
 *
 * @param {string} collectionName
 * @param {object} [options]
 * @param {boolean} [options.trash=false] - The collection's deletions go to the trash (utils/trash.js) - its
 *   reads then skip the records in it (useAll({ includeTrashed: true }) keeps
 *   them, for a reader that must tell a trashed record from a missing one).
 * @returns {object}
 */
export function createCollectionModel(collectionName, { trash = false } = {}) {
  const visible = (item) => !trash || !isTrashed(item)
  // The collection's reference, from the Firebase module (loadFirebase).
  const refIn = ({ db, collection }) => collection(db, collectionName).withConverter(converter)

  return {
    collectionName,

    /**
     * The collection's reference (with its converter), once Firebase is loaded.
     *
     * @returns {Promise<import('firebase/firestore').CollectionReference>}
     */
    async collectionRef() {
      return refIn(await loadFirebase())
    },

    async getAll() {
      const firebase = await loadFirebase()
      const snapshot = await firebase.getDocs(refIn(firebase))
      return snapshot.docs.map(d => d.data()).filter(visible)
    },

    async getById(id) {
      const { db, doc, getDoc } = await loadFirebase()
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
      const { db, doc, setDoc } = await loadFirebase()
      await setDoc(doc(db, collectionName, id), definedFields, { merge: true })
    },

    async remove(id) {
      const { db, doc, deleteDoc } = await loadFirebase()
      await deleteDoc(doc(db, collectionName, id))
    },

    // To the trash (admins): kept, with who moved it there and when, until
    // it's restored or deleted for good (Audits > Trash).
    async moveToTrash(id) {
      const { auth, db, doc, serverTimestamp, updateDoc } = await loadFirebase()
      await updateDoc(doc(db, collectionName, id), { deletedAt: serverTimestamp(), deletedBy: auth.currentUser?.uid ?? null })
    },

    async restore(id) {
      const { db, deleteField, doc, updateDoc } = await loadFirebase()
      await updateDoc(doc(db, collectionName, id), { deletedAt: deleteField(), deletedBy: deleteField() })
    },

    // The records in the trash, most recently deleted first.
    async getTrashed() {
      const firebase = await loadFirebase()
      const { getDocs, orderBy, query, where } = firebase
      const snapshot = await getDocs(query(refIn(firebase), where('deletedAt', '!=', null), orderBy('deletedAt', 'desc')))
      return snapshot.docs.map(d => d.data())
    },

    useAll({ includeTrashed = false } = {}) {
      // On a page the server rendered: the server's (ssrContext.js), by the
      // collection's name.
      const [snapshot, loading, error] = useSsrCollection(collectionName, refIn, { converter })
      const items = useMemo(() => snapshot?.docs.map(d => d.data()).filter((item) => includeTrashed || visible(item)) || [], [snapshot, includeTrashed])
      return [items, loading, error]
    }
  }
}
