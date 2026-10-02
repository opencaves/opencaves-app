import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { CAVE_LAYER } from '@/config/map.js'

// The cave layer's settings shared by everyone (settings/caveLayer): the maps
// whose drawing editors removed from the layer (hiddenMaps: the maps' names,
// as in the tiles). Readable by all, written by editors (the layer's edit mode).
const settingsDoc = () => doc(db, CAVE_LAYER.SETTINGS_DOC)

export function subscribeHiddenMaps(callback) {
  return onSnapshot(
    settingsDoc(),
    (snapshot) => callback(snapshot.get('hiddenMaps') || []),
    () => callback([]),
  )
}

export function setMapHidden(name, hidden) {
  return setDoc(settingsDoc(), { hiddenMaps: hidden ? arrayUnion(name) : arrayRemove(name) }, { merge: true })
}
