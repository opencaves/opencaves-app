import { useMemo, useState } from 'react'
import { collection, documentId, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { POPULARITY_COLLECTION } from '@/config/collections.js'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'

/**
 * How popular a kind's records are (_popularity/<kind>: page views, a
 * cave's saves), for a list ranked by usefulness (utils/caveRank.js) - read
 * once needed, then kept for the visit (the browser's Firestore cache too);
 * on a page the server rendered, its copy first (ssr/pageState.js:
 * "popularity:<kind>"). No document (the emulators, before the first
 * nightly build) or a failed read: views and saves empty, the ranking
 * starts at its next signal.
 *
 * @param {'caves'|'sistemas'} kind
 * @param {boolean} needed - Whether the page ranks them (once true, read until the page closes).
 * @returns {{popularity: Popularity|null, loading: boolean}} popularity: null until read.
 */
export function usePopularity(kind, needed) {
  const [asked, setAsked] = useState(needed)
  if (needed && !asked) setAsked(true)
  // The one document, as a query (useSsrCollection's): the server sends its results.
  const q = useMemo(() => (asked ? query(collection(db, POPULARITY_COLLECTION), where(documentId(), '==', kind)) : null), [asked, kind])
  const [snapshot, , error] = useSsrCollection(`popularity:${kind}`, q)
  const popularity = useMemo(() => {
    if (!snapshot && !error) return null
    const data = snapshot?.docs[0]?.data()
    return { views: data?.views || {}, saves: data?.saves || {} }
  }, [snapshot, error])
  return { popularity, loading: asked && !popularity }
}
