import { useEffect, useState } from 'react'
import { collection, doc as docRef, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { isTrashed } from '@/utils/trash.js'

// The scan a cave layer drawing was traced from: its "maps" document, found by
// the importKey its config carries (mapImportKey - the same in every database,
// unlike the document's id), or for a map added in the app (no importKey) by
// its id (mapId: the production mirror keeps the ids). Null while loading, or
// when there's none (or it's in the trash).
export function useMapScan(importKey, mapId) {
  const [scan, setScan] = useState(null)

  useEffect(() => {
    setScan(null)
    if (!importKey && !mapId) return undefined
    let cancelled = false
    const found = importKey
      ? getDocs(query(collection(db, 'maps'), where('importKey', '==', importKey))).then((snapshot) => snapshot.docs.find((d) => !isTrashed(d)))
      : getDoc(docRef(db, 'maps', mapId)).then((d) => (d.exists() && !isTrashed(d) ? d : null))
    found
      .then((doc) => {
        if (!cancelled && doc) setScan({ id: doc.id, ...doc.data() })
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [importKey, mapId])

  return scan
}
