import { useEffect, useSyncExternalStore } from 'react'
import { whenFirebaseNeeded } from '@/utils/loadFirebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'

// One listener for every user of the count (the account button, its menu,
// the dashboard - several on screen at once): opened by the first, closed
// by the last.
let count = 0
let users = 0
let unsubscribe = null
const listeners = new Set()

function setCount(next) {
  if (next === count) return
  count = next
  listeners.forEach((listener) => listener())
}

function retain() {
  users += 1
  if (users > 1) return
  // Firebase loaded first: the listener opened then, unless released by then.
  let stopped = false
  let stop = null
  unsubscribe = () => {
    stopped = true
    stop?.()
  }
  whenFirebaseNeeded().then(({ db, collection, onSnapshot, query, where }) => {
    if (stopped) return
    stop = onSnapshot(
      query(collection(db, FEEDBACK_COLLECTION), where('status', '==', 'new')),
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    )
  }, () => setCount(0))
}

function release() {
  users -= 1
  if (users > 0) return
  unsubscribe?.()
  unsubscribe = null
  setCount(0)
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * How many members' reports are still new (stage new) - the account button's
 * badge, its menu's Dashboard entry and the dashboard's Feedback entry show
 * it. Admins only (firestore.rules): 0 for anyone else. Every user shares one
 * Firestore listener.
 *
 * @param {boolean} enabled
 * @returns {number}
 */
export function useNewFeedbackCount(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    retain()
    return release
  }, [enabled])
  const shared = useSyncExternalStore(subscribe, () => count, () => 0)
  return enabled ? shared : 0
}
