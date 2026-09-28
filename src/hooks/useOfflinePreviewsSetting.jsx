import { useSyncExternalStore } from 'react'

// Per-device opt-in for downloading every cave's cover thumbnail for offline
// use - a device-local convenience, so localStorage (guarded: it can be
// unavailable or throw, in which case the setting just defaults to off).
const STORAGE_KEY = 'oc-offline-previews'
const listeners = new Set()

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setOfflinePreviewsEnabled(enabled) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not persisted; the setting stays as it was.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOfflinePreviewsEnabled() {
  return useSyncExternalStore(subscribe, read, () => false)
}
