import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { UNIT_SYSTEMS } from '@/utils/units.js'
import { USERS_COLLECTION } from '@/config/collections.js'

// The units a person picked (the account page's UnitsSection), kept in the
// signed-in account (users/{uid}.units) so they follow them to other devices;
// absent for Automatic. On the device they're in the preferences slice.
export async function loadAccountUnits(uid) {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))
  const units = snapshot.exists() ? snapshot.get('units') : null
  return UNIT_SYSTEMS.includes(units) ? units : null
}

export function saveAccountUnits(uid, units) {
  return setDoc(doc(db, USERS_COLLECTION, uid), { units: UNIT_SYSTEMS.includes(units) ? units : deleteField() }, { merge: true })
}
