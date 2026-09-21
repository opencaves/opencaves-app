import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase.js'

const COLLECTION_NAMES = {
  caves: 'caves',
  sistemas: 'sistemas',
  connections: 'connections',
  accesses: 'accesses',
  accessibilities: 'accessibilities',
  sources: 'sources',
  areas: 'areas',
  colors: 'colors',
  languages: 'languages'
}

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Reads all 9 cave-data collections from Firestore. Caller is expected to
// run this through postProcessCaveData() before use.
export async function readCaveDataFromFirestore() {
  const entries = await Promise.all(
    Object.entries(COLLECTION_NAMES).map(async ([key, name]) => [key, await readCollection(name)])
  )

  return Object.fromEntries(entries)
}
