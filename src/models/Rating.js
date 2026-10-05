import { useMemo } from 'react'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useDocument } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'

// Ratings live under their cave, one per user:
// caves/{caveId}/ratings/{userId} = { value: 1-5, userId, updatedAt }, so
// rating again replaces the previous one. Each is private to its author
// (and admins): what everyone reads is the cave's summary,
// caveRatings/{caveId} = { average, count }, which the onRatingWritten
// function keeps up to date. Only editors and admins may rate
// (firestore.rules). Deleting an account removes its ratings (onUserDelete).
const RATINGS = 'ratings'
const SUMMARIES = 'caveRatings'

function ownRatingRef(caveId, userId) {
  return doc(db, 'caves', caveId, RATINGS, userId)
}

// Sets (1-5) or clears (null) this user's rating of a cave.
export async function setUserRating(caveId, userId, value) {
  const ref = ownRatingRef(caveId, userId)
  if (value === null) {
    await deleteDoc(ref)
    return
  }
  await setDoc(ref, { value, userId, updatedAt: serverTimestamp() })
}

// Live average and count of a cave's ratings, and (when userId is given)
// that user's own rating. The summary follows the function's update, a
// moment after a rating changes; the user's own rating shows at once.
export function useCaveRatings(caveId, userId) {
  const [summary, summaryLoading] = useDocument(caveId ? doc(db, SUMMARIES, caveId) : null)
  const [own, ownLoading] = useDocument(caveId && userId ? ownRatingRef(caveId, userId) : null)

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
