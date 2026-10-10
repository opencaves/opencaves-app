import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { USERS_COLLECTION } from '@/config/collections.js'

/**
 * Whether the map's legend (CaveLayerLegend) was left open or closed, kept in
 * the signed-in account (_users/{uid}.mapLegendOpen) so it follows the person
 * to other devices; absent until they first open or close it. On the device
 * it's in the preferences slice.
 *
 * @param {string} uid
 * @returns {Promise<boolean|null>} Null when never set.
 */
export async function loadAccountMapLegendOpen(uid) {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))
  const open = snapshot.exists() ? snapshot.get('mapLegendOpen') : null
  return typeof open === 'boolean' ? open : null
}

/**
 * Saves the legend's state in the signed-in account.
 *
 * @param {string} uid
 * @param {boolean} open
 * @returns {Promise<void>}
 */
export function saveAccountMapLegendOpen(uid, open) {
  return setDoc(doc(db, USERS_COLLECTION, uid), { mapLegendOpen: Boolean(open) }, { merge: true })
}
