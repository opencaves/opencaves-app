import { useEffect, useState } from 'react'
import { whenFirebaseNeeded } from '@/utils/loadFirebase.js'

// A query's or a document's snapshot, live, its query (or reference) made
// once Firebase is loaded: useLazyCollection's and useLazyDocument's.
/**
 * @param {((firebase: typeof import('@/config/firebase.js')) => object|null)|null} makeQuery
 * @param {{snapshotListenOptions?: {includeMetadataChanges?: boolean}}} [options]
 * @returns {[any, boolean, Error|undefined]}
 */
function useLazySnapshot(makeQuery, { snapshotListenOptions } = {}) {
  const includeMetadataChanges = Boolean(snapshotListenOptions?.includeMetadataChanges)
  const [result, setResult] = useState({ makeQuery: null, snapshot: undefined, error: undefined })

  useEffect(() => {
    if (!makeQuery) return undefined
    let unsubscribe = null
    let stopped = false
    const settle = (snapshot, error) => {
      if (!stopped) setResult({ makeQuery, snapshot, error })
    }
    whenFirebaseNeeded()
      .then((firebase) => {
        if (stopped) return
        const query = makeQuery(firebase)
        if (!query) return settle(undefined, undefined)
        unsubscribe = firebase.onSnapshot(/** @type {any} */ (query), { includeMetadataChanges }, (snapshot) => settle(snapshot, undefined), (error) => settle(undefined, error))
      })
      .catch((error) => settle(undefined, error))
    return () => {
      stopped = true
      unsubscribe?.()
    }
  }, [makeQuery, includeMetadataChanges])

  if (!makeQuery) return [undefined, false, undefined]
  if (result.makeQuery !== makeQuery) return [undefined, true, undefined]
  return [result.snapshot, false, result.error]
}

/**
 * A Firestore query's results, live (onSnapshot): react-firebase-hooks'
 * useCollection, [snapshot, loading, error], with the query made once
 * Firebase is loaded ({@link whenFirebaseNeeded}) - so the components using
 * it don't load the Firebase SDK with their own code.
 *
 * @param {((firebase: typeof import('@/config/firebase.js')) => import('firebase/firestore').Query|null)|null} makeQuery - Makes
 *   the query from the Firebase module (its `db` and SDK functions); null (or
 *   returning null): none. Memoized by the caller (useCallback, useMemo): a
 *   new function is a new query.
 * @param {object} [options]
 * @param {{includeMetadataChanges?: boolean}} [options.snapshotListenOptions]
 * @returns {[import('firebase/firestore').QuerySnapshot|undefined, boolean, Error|undefined]}
 */
export function useLazyCollection(makeQuery, options) {
  return /** @type {[import('firebase/firestore').QuerySnapshot|undefined, boolean, Error|undefined]} */ (useLazySnapshot(makeQuery, options))
}

/**
 * A Firestore document, live (onSnapshot): react-firebase-hooks'
 * useDocument, [snapshot, loading, error], with its reference made once
 * Firebase is loaded ({@link whenFirebaseNeeded}).
 *
 * @param {((firebase: typeof import('@/config/firebase.js')) => import('firebase/firestore').DocumentReference|null)|null} makeRef - Makes
 *   the document's reference (as {@link useLazyCollection}'s makeQuery).
 * @returns {[import('firebase/firestore').DocumentSnapshot|undefined, boolean, Error|undefined]}
 */
export function useLazyDocument(makeRef) {
  return /** @type {[import('firebase/firestore').DocumentSnapshot|undefined, boolean, Error|undefined]} */ (useLazySnapshot(makeRef))
}
