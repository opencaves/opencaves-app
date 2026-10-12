import { useMemo, useState } from 'react'
import { collection, documentId, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { CAVE_POPULARITY_COLLECTION, CAVE_POPULARITY_DOC_ID } from '@/config/collections.js'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'

/**
 * How popular each cave is (_cavePopularity/latest: page views, saves), for
 * the caves' list ranked by usefulness (utils/caveRank.js) - read once
 * needed, then kept for the visit (the browser's Firestore cache too); on
 * the page the server rendered, its copy first (ssr/pageState.js:
 * "popularity"). No document (the emulators, before the first nightly
 * build) or a failed read: views and saves empty, the ranking starts at its
 * next signal.
 *
 * @param {boolean} needed - Whether the page ranks the caves (once true, read until the page closes).
 * @returns {{popularity: CavePopularity|null, loading: boolean}} popularity: null until read.
 */
export function useCavePopularity(needed) {
  const [asked, setAsked] = useState(needed)
  if (needed && !asked) setAsked(true)
  // The one document, as a query (useSsrCollection's): the server sends its results.
  const q = useMemo(() => (asked ? query(collection(db, CAVE_POPULARITY_COLLECTION), where(documentId(), '==', CAVE_POPULARITY_DOC_ID)) : null), [asked])
  const [snapshot, , error] = useSsrCollection('popularity', q)
  const popularity = useMemo(() => {
    if (!snapshot && !error) return null
    const data = snapshot?.docs[0]?.data()
    return { views: data?.views || {}, saves: data?.saves || {} }
  }, [snapshot, error])
  return { popularity, loading: asked && !popularity }
}
