import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { collection, deleteDoc, doc, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'

// Caves the signed-in user saved via the result pane's Save quick action,
// stored as users/{uid}/savedCaves/{caveId} (see firestore.rules). Anonymous
// and signed-out sessions have no saved caves - they're prompted to create
// an account instead.
export function useSavedCaves() {
  const uid = useSelector((state) => state.session.user?.uid)
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const canSave = !!uid && isLoggedIn

  const savedQuery = useMemo(() => (canSave ? query(collection(db, 'users', uid, 'savedCaves'), orderBy('savedAt', 'desc')) : null), [canSave, uid])
  const [snapshot, loading] = useCollection(savedQuery)

  // Most recently saved first.
  const savedCaveIds = useMemo(() => snapshot?.docs.map((d) => d.id) || [], [snapshot])
  const savedCaveIdSet = useMemo(() => new Set(savedCaveIds), [savedCaveIds])

  async function saveCave(caveId) {
    await setDoc(doc(db, 'users', uid, 'savedCaves', caveId), { savedAt: serverTimestamp() })
  }

  async function unsaveCave(caveId) {
    await deleteDoc(doc(db, 'users', uid, 'savedCaves', caveId))
  }

  return { canSave, loading: canSave && loading, savedCaveIds, isSaved: (caveId) => savedCaveIdSet.has(caveId), saveCave, unsaveCave }
}
