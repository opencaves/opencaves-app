import { useMemo, useState } from 'react'
import { collection, documentId, query, where } from 'firebase/firestore'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'
import { POPULARITY_COLLECTION } from '@/config/collections.js'

/**
 * How popular a kind's records are (_popularity/<kind>: page views, a
 * cave's saves), for the search fields' suggestions to come (the app bar's,
 * the landing page's and the map's search: the most visited first) - no
 * caller yet. Read once needed, then kept for the visit (the browser's
 * Firestore cache too). No document (the emulators, before the first
 * nightly build) or a failed read: views and saves empty.
 *
 * @param {'caves'|'sistemas'} kind
 * @param {boolean} [needed=true] - Whether the page needs them yet (once true, read until it closes).
 * @returns {{popularity: Popularity|null, loading: boolean}} popularity: null until read.
 */
export function usePopularity(kind, needed = true) {
  const [asked, setAsked] = useState(needed)
  if (needed && !asked) setAsked(true)
  // The one document, as a query: none there reads as an empty result, not an error.
  const q = useMemo(() => (asked ? query(collection(db, POPULARITY_COLLECTION), where(documentId(), '==', kind)) : null), [asked, kind])
  const [snapshot, , error] = useCollection(q)
  const popularity = useMemo(() => {
    if (!snapshot && !error) return null
    const data = snapshot?.docs[0]?.data()
    return { views: data?.views || {}, saves: data?.saves || {} }
  }, [snapshot, error])
  return { popularity, loading: asked && !popularity }
}
