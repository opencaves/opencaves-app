import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { USERS_COLLECTION } from '@/config/collections.js'

// The display mode a person picked (the account page's AppearanceSection):
// 'light', 'dark', or 'system' (Automatic: the device's setting). On the
// device MUI keeps it (localStorage "mui-mode"); a signed-in account also
// keeps it in users/{uid}.colorMode so it follows the person to other devices.
// Always stored explicitly: the app's default (light) isn't Automatic.
export const COLOR_MODES = ['system', 'light', 'dark']

export async function loadAccountColorMode(uid) {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))
  const mode = snapshot.exists() ? snapshot.get('colorMode') : null
  return COLOR_MODES.includes(mode) ? mode : null
}

export function saveAccountColorMode(uid, mode) {
  return setDoc(doc(db, USERS_COLLECTION, uid), { colorMode: mode }, { merge: true })
}
