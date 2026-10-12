import { CAVE_LAYER } from '@/config/map.js'
import { loadFirebase, whenFirebaseNeeded } from '@/utils/loadFirebase.js'

// The cave layer's settings shared by everyone (settings/caveLayer): the maps
// whose drawing editors removed from the layer (hiddenMaps: the maps' names,
// as in the tiles). Readable by all, written by editors (the layer's edit mode).

/**
 * Follows the maps hidden from the layer, once Firebase is needed (utils/loadFirebase.js).
 *
 * @param {(hiddenMaps: string[]) => void} callback - With the hidden maps' names; none on an error.
 * @returns {() => void} Unsubscribes.
 */
export function subscribeHiddenMaps(callback) {
  let unsubscribe = null
  let stopped = false
  whenFirebaseNeeded().then(({ db, doc, onSnapshot }) => {
    if (stopped) return
    unsubscribe = onSnapshot(
      doc(db, CAVE_LAYER.SETTINGS_DOC),
      (snapshot) => callback(snapshot.get('hiddenMaps') || []),
      () => callback([]),
    )
  }, () => callback([]))
  return () => {
    stopped = true
    unsubscribe?.()
  }
}

/**
 * Hides a map's drawing from the layer, or shows it again (editors).
 *
 * @param {string} name - The map's name, as in the tiles.
 * @param {boolean} hidden
 * @returns {Promise<void>}
 */
export async function setMapHidden(name, hidden) {
  const { db, arrayRemove, arrayUnion, doc, setDoc } = await loadFirebase()
  return setDoc(doc(db, CAVE_LAYER.SETTINGS_DOC), { hiddenMaps: hidden ? arrayUnion(name) : arrayRemove(name) }, { merge: true })
}
