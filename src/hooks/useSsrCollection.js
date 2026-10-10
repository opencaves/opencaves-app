import { useState } from 'react'
import { useCollection } from 'react-firebase-hooks/firestore'
import { ssrQuerySnapshot } from '@/ssr/ssrContext.js'

/**
 * {@link useCollection} (react-firebase-hooks), which on a page the server rendered
 * (entry-server.jsx) starts with the results the server read for it (key:
 * ssrContext.js) instead of loading: the server draws the page with them, and
 * the browser's first render is the same (hydration) - until Firestore's own
 * results replace them. Elsewhere, {@link useCollection} as it is.
 *
 * @param {string} key
 * @param {Query|null} query
 * @param {object} [options]
 * @returns {[QuerySnapshot|undefined, boolean, Error|undefined]}
 */
export function useSsrCollection(key, query, options) {
  // Kept from the first render (the hydration), for its key only: another
  // cave's page in the same component loads as usual.
  const [initial] = useState(() => ({ key, snapshot: ssrQuerySnapshot(key, query?.converter) }))
  // No listener on the server (effects don't run there anyway).
  const [snapshot, loading, error] = useCollection(import.meta.env.SSR ? null : query, options)
  if (!snapshot && !error && initial.snapshot && initial.key === key) return [initial.snapshot, false, undefined]
  return [snapshot, loading, error]
}
