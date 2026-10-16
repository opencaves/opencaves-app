// A page opened before a deploy still runs the old build: the code it loads
// on demand (a route, a pane) names files the new build no longer has, and
// the import fails ("Failed to fetch dynamically imported module"). A reload
// gets the new build - once per RELOAD_WINDOW_MS, so a file really missing
// from the site ends on the error page instead of a reload loop.
const RELOAD_KEY = 'oc-stale-build-reload'
const RELOAD_WINDOW_MS = 10 * 60 * 1000

/**
 * Whether the error is a module of the app that failed to load: Chrome's,
 * Firefox's and Safari's messages, and Vite's for a stylesheet.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStaleBuildError(error) {
  const message = String(/** @type {{ message?: string }} */ (error)?.message ?? error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message)
}

/**
 * Reloads the page for the new build, unless that was already tried within
 * {@link RELOAD_WINDOW_MS}.
 *
 * @returns {boolean} False when it was: the error is the visitor's to see.
 */
export function reloadForNewBuild() {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - at < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Storage blocked: no reload, as nothing would stop a loop.
    return false
  }
  window.location.reload()
  return true
}

/**
 * Vite's own report of an import that failed (its `vite:preloadError`
 * event): the page reloaded instead of the error reaching the app.
 */
export function watchStaleBuild() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault()
  })
}
