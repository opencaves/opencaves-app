import { useMemo } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'

const converter = {
  toFirestore: (data) => data,
  fromFirestore: (snapshot, options) => ({ id: snapshot.id, ...snapshot.data(options) })
}

// Shared read/write access for the plain-object cave-data collections
// (caves, sistemas, connections, and the reference-data collections). Mirrors
// the converter + useCollection pattern established in models/CaveAsset.js,
// the only other Firestore data-access precedent in this app, generalized
// since these collections don't need per-entity classes/behavior.
export function createCollectionModel(collectionName) {
  const collectionRef = collection(db, collectionName).withConverter(converter)

  return {
    collectionName,
    collectionRef,

    async getAll() {
      const snapshot = await getDocs(collectionRef)
      return snapshot.docs.map(d => d.data())
    },

    async getById(id) {
      const snapshot = await getDoc(doc(db, collectionName, id).withConverter(converter))
      return snapshot.exists() ? snapshot.data() : null
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

    useAll() {
      const [snapshot, loading, error] = useCollection(collectionRef)
      const items = useMemo(() => snapshot?.docs.map(d => d.data()) || [], [snapshot])
      return [items, loading, error]
    }
  }
}
