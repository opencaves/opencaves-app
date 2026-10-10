import localforage from 'localforage'

// Photos and maps added offline, kept on the device until they can upload
// (PendingUploadsSync, on Wi-Fi). Each: { id, kind: 'map' | 'photo', uid
// (who added it - only their session uploads it), file (the Blob), name,
// createdAt, state: 'waiting' | 'failed', error } and, for a map, its
// details ({ title, authors, date, note }) and, when added from a system's
// maps list, sistemaId (it's added to the system once uploaded); for a photo,
// caveId. A map's id is its record's id from the start (the edit form can
// already list it).
const store = localforage.createInstance({ name: 'OpenCaves', storeName: 'pendingUploads' })

let items = []
let loaded = false
const listeners = new Set()

async function refresh() {
  const next = []
  await store.iterate((value) => {
    next.push(value)
  })
  items = next.sort((a, b) => a.createdAt - b.createdAt)
  loaded = true
  listeners.forEach((listener) => listener())
}

export function subscribePendingUploads(listener) {
  listeners.add(listener)
  if (!loaded) refresh().catch((error) => console.warn('[pendingUploads]', error))
  return () => listeners.delete(listener)
}

export const getPendingUploads = () => items

export async function addPendingUpload(record) {
  await store.setItem(record.id, { state: 'waiting', createdAt: Date.now(), ...record })
  await refresh()
}

export async function updatePendingUpload(id, changes) {
  const record = await store.getItem(id)
  if (!record) return
  await store.setItem(id, { ...record, ...changes })
  await refresh()
}

export async function removePendingUpload(id) {
  await store.removeItem(id)
  await refresh()
}

/**
 * The uploads still waiting for this account (asked before signing out).
 *
 * @param {string} uid
 * @returns {number}
 */
export const pendingCountFor = (uid) => items.filter((item) => item.uid === uid).length

export async function loadPendingUploads() {
  await refresh()
  return items
}
