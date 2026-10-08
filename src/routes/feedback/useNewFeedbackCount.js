import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'

// How many testers' reports are still new (not done) - the dashboard's
// Feedback entry shows it. Admins only (firestore.rules): 0 for anyone else.
export function useNewFeedbackCount(enabled) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    return onSnapshot(
      query(collection(db, FEEDBACK_COLLECTION), where('status', '==', 'new')),
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    )
  }, [enabled])
  return count
}
