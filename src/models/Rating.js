import { useMemo } from 'react'
import { useLazyDocument } from '@/hooks/useLazyCollection.js'
import { loadFirebase } from '@/utils/loadFirebase.js'
import { CAVE_RATINGS_COLLECTION } from '@/config/collections.js'

// Ratings live under their cave, one per user:
// caves/{caveId}/ratings/{userId} = { value: 1-5, userId, updatedAt }, so
// rating again replaces the previous one. Each is private to its author
// (and admins): what everyone reads is the cave's summary,
// caveRatings/{caveId} = { average, count }, which the onRatingWritten
// function keeps up to date. Only editors and admins may rate
// (firestore.rules). Deleting an account removes its ratings (onUserDelete).
const RATINGS = 'ratings'
const SUMMARIES = CAVE_RATINGS_COLLECTION

// The user's own rating's reference, from the Firebase module (loadFirebase).
function ownRatingRef({ db, doc }, caveId, userId) {
  return doc(db, 'caves', caveId, RATINGS, userId)
}

/**
 * Sets (1-5) or clears (null) this user's rating of a cave.
 *
 * @param {string} caveId
 * @param {string} userId
 * @param {number|null} value
 */
export async function setUserRating(caveId, userId, value) {
  const firebase = await loadFirebase()
  const { deleteDoc, serverTimestamp, setDoc } = firebase
  const ref = ownRatingRef(firebase, caveId, userId)
  if (value === null) {
    await deleteDoc(ref)
    return
  }
  await setDoc(ref, { value, userId, updatedAt: serverTimestamp() })
}

/**
 * Live average and count of a cave's ratings, and (when userId is given)
 * that user's own rating. The summary follows the function's update, a
 * moment after a rating changes; the user's own rating shows at once.
 *
 * @param {string} caveId
 * @param {string} [userId]
 * @returns {{loading: boolean, average: number|null, count: number, own: number|null}}
 */
export function useCaveRatings(caveId, userId) {
  const summaryRef = useMemo(() => (caveId ? ({ db, doc }) => doc(db, SUMMARIES, caveId) : null), [caveId])
  const ownRef = useMemo(() => (caveId && userId ? (firebase) => ownRatingRef(firebase, caveId, userId) : null), [caveId, userId])
  const [summary, summaryLoading] = useLazyDocument(summaryRef)
  const [own, ownLoading] = useLazyDocument(ownRef)

  return useMemo(() => {
    const data = summary?.data()
    return {
      loading: summaryLoading || ownLoading,
      average: typeof data?.average === 'number' ? data.average : null,
      count: data?.count || 0,
      own: own?.data()?.value ?? null,
    }
  }, [summary, own, summaryLoading, ownLoading])
}
