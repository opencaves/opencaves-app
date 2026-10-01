import { useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

// Whether the device has a network connection, kept up to date. false is
// reliable (airplane mode, no network); true only means a network is there,
// not that a server is reachable.
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
