import { loadFirebase, whenFirebaseNeeded } from '@/utils/loadFirebase.js'

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
  const { db, collection, getDocs } = await loadFirebase()
  const snapshot = await getDocs(collection(db, name))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

/**
 * Reads all 9 cave-data collections from Firestore. Caller is expected to
 * run this through postProcessCaveData() before use.
 *
 * @returns {Promise<CaveData>}
 */
export async function readCaveDataFromFirestore() {
  const entries = await Promise.all(
    Object.entries(COLLECTION_NAMES).map(async ([key, name]) => [key, await readCollection(name)])
  )

  return Object.fromEntries(entries)
}

/**
 * Follows the 9 cave-data collections, live, once Firebase is needed
 * (utils/loadFirebase.js: on a page the server rendered, which has its data,
 * not at once).
 *
 * @param {(data: object) => void} onData - With every collection, each time one changes.
 * @param {(error: Error) => void} onError
 * @returns {() => void} Unsubscribes.
 */
export function subscribeToCaveData(onData, onError) {
  const data = {}
  const names = Object.entries(COLLECTION_NAMES)
  // onData runs in a task of its own, not inside Firestore's snapshot
  // callback: that task is already long (Firestore applying and caching the
  // documents), and processing plus rendering ~900 caves on top of it made
  // one long block of main-thread work. Snapshots arriving close together
  // are coalesced into one onData.
  let scheduled = null
  let unsubscribers = []
  let stopped = false
  whenFirebaseNeeded().then(({ db, collection, onSnapshot }) => {
    if (stopped) return
    unsubscribers = names.map(([key, name]) => onSnapshot(collection(db, name), snapshot => {
      data[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      if (Object.keys(data).length === names.length && !scheduled) {
        scheduled = setTimeout(() => {
          scheduled = null
          onData({ ...data })
        })
      }
    }, onError))
  }, onError)

  return () => {
    stopped = true
    clearTimeout(scheduled)
    unsubscribers.forEach(unsubscribe => unsubscribe())
  }
}
