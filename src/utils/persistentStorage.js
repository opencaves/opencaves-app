// Asks the browser to keep this origin's storage (Firestore's offline cache,
// persisted Redux state, the service worker's caches) instead of evicting it
// under storage pressure - otherwise offline data can silently vanish.
//
// Chromium grants or denies without asking, but Firefox shows a permission
// prompt, so this is only called when there's a clear offline intent (an
// installed app, a saved cenote) rather than on every page load.
let requested = false

export async function requestPersistentStorage() {
  if (requested || !navigator.storage?.persist) {
    return false
  }
  requested = true

  try {
    if (await navigator.storage.persisted()) {
      return true
    }
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * Installed as an app (home screen / desktop PWA), where offline use is the
 * whole point.
 */
export function isInstalledApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || /** @type {Navigator & {standalone?: boolean}} */ (window.navigator).standalone === true
}
