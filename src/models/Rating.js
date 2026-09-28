import { useMemo } from 'react'
import { collectionGroup, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'

// Ratings live in each user's own data, one per cave:
// users/{userId}/ratings/{caveId} = { caveId, value: 1-5, updatedAt }, so
// rating again replaces the previous one and deleting an account removes
// its ratings (onUserDelete deletes users/{uid} recursively). Only editors
// and admins may write (firestore.rules). A cave's average reads every
// user's rating of it through a collection-group query on caveId (its
// COLLECTION_GROUP index is declared in firestore.indexes.json).
const RATINGS = 'ratings'

function ratingsOfCave(caveId) {
  return query(collectionGroup(db, RATINGS), where('caveId', '==', caveId))
}

// The user a rating doc belongs to: users/{userId}/ratings/{caveId}.
function ratingOwner(snapshot) {
  return snapshot.ref.parent.parent?.id
}

export default class Rating {

  static async getByCaveId(caveId) {
    const rating = new Rating(caveId)
    const snapshot = await getDocs(ratingsOfCave(caveId))

    if (snapshot.empty) {
      rating.value = null
      return rating
    }

    let sum = 0
    snapshot.forEach(d => {
      sum += d.data().value
    })
    rating.value = sum / snapshot.size
    return rating
  }

  // Sets (1-5) or clears (null) this user's rating of a cave.
  static async setUserRating(caveId, userId, value) {
    const ref = doc(db, 'users', userId, RATINGS, caveId)
    if (value === null) {
      await deleteDoc(ref)
      return
    }
    await setDoc(ref, { caveId, value, updatedAt: serverTimestamp() })
  }

  constructor(caveId, value = null) {
    this.caveId = caveId
    this.value = value
  }
}

// Live average, count and (when userId is given) that user's own rating of a
// cave - updates as soon as anyone rates.
export function useCaveRatings(caveId, userId) {
  const ratingsQuery = useMemo(() => (caveId ? ratingsOfCave(caveId) : null), [caveId])
  const [snapshot, loading] = useCollection(ratingsQuery)

  return useMemo(() => {
    const docs = snapshot?.docs || []
    const values = docs.map(d => d.data().value).filter(v => typeof v === 'number')
    const average = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
    const own = userId ? docs.find(d => ratingOwner(d) === userId)?.data().value ?? null : null
    return { loading, average, count: values.length, own }
  }, [snapshot, loading, userId])
}

export const getByCaveId = Rating.getByCaveId
export const setUserRating = Rating.setUserRating
