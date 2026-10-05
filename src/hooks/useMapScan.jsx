import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { isTrashed } from '@/utils/trash.js'

// The scan a cave layer drawing was traced from: its "maps" document, found by
// the importKey its config carries (mapImportKey - the same in every database,
// unlike the document's id). Null while loading, or when there's none (or
// it's in the trash).
export function useMapScan(importKey) {
  const [scan, setScan] = useState(null)

  useEffect(() => {
    setScan(null)
    if (!importKey) return undefined
    let cancelled = false
    getDocs(query(collection(db, 'maps'), where('importKey', '==', importKey)))
      .then((snapshot) => {
        const doc = snapshot.docs.find((d) => !isTrashed(d))
        if (!cancelled && doc) setScan({ id: doc.id, ...doc.data() })
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [importKey])

  return scan
}
