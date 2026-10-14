import { useState } from 'react'
import { useLazyCollection } from '@/hooks/useLazyCollection.js'
import { ssrQuerySnapshot } from '@/ssr/ssrContext.js'

/**
 * {@link useLazyCollection} (react-firebase-hooks' useCollection, its query
 * made once Firebase is loaded), which on a page the server rendered
 * (entry-server.jsx) starts with the results the server read for it (key:
 * ssrContext.js) instead of loading: the server draws the page with them, and
 * the browser's first render is the same (hydration) - until Firestore's own
 * results replace them. Elsewhere, {@link useLazyCollection} as it is.
 *
 * @param {string} key
 * @param {((firebase: typeof import('@/config/firebase.js')) => import('firebase/firestore').Query|null)|null} makeQuery - Makes
 *   the query (see {@link useLazyCollection}); memoized by the caller.
 * @param {object} [options]
 * @param {import('firebase/firestore').FirestoreDataConverter} [options.converter] - The query's converter,
 *   for the server's results as Firestore's would come.
 * @param {{includeMetadataChanges?: boolean}} [options.snapshotListenOptions]
 * @returns {[import('firebase/firestore').QuerySnapshot|undefined, boolean, Error|undefined]}
 */
export function useSsrCollection(key, makeQuery, { converter, snapshotListenOptions } = {}) {
  // Kept from the first render (the hydration), for its key only: another
  // cave's page in the same component loads as usual.
  const [initial] = useState(() => ({ key, snapshot: ssrQuerySnapshot(key, converter) }))
  // No listener on the server (effects don't run there anyway).
  const [snapshot, loading, error] = useLazyCollection(import.meta.env.SSR ? null : makeQuery, { snapshotListenOptions })
  if (!snapshot && !error && initial.snapshot && initial.key === key) return [initial.snapshot, false, undefined]
  return [snapshot, loading, error]
}
