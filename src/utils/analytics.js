// Whether this visit may load Google Tag Manager (and so Google Analytics):
// only the real site's visitors count - not the dev server, the preview
// channels or Firebase's default domain, not automated browsers (tests,
// the deploy's checks), and not a device that opted out.

// The site's own addresses.
const ANALYTICS_HOSTS = ['opencaves.org', 'www.opencaves.org']

// The device's opt-out, kept in its browser: set by visiting any page with
// ?no-analytics, cleared with ?analytics.
const OPT_OUT_KEY = 'oc-no-analytics'

/**
 * Reads this page's ?no-analytics or ?analytics and keeps the device's
 * choice. The parameter stays in the address: the router has read it already
 * (changing it now would leave the router behind), and nothing else reads it.
 */
export function applyAnalyticsOptOut() {
  const params = new URLSearchParams(window.location.search)
  const optOut = params.has('no-analytics')
  const optIn = params.has('analytics')
  if (!optOut && !optIn) return
  try {
    if (optOut) window.localStorage.setItem(OPT_OUT_KEY, new Date().toISOString())
    else window.localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Nowhere to keep it: the parameter still holds for this page.
  }
}

/**
 * Whether analytics may load on this visit: on the site's own addresses
 * (ANALYTICS_HOSTS), in a browser no automation drives (navigator.webdriver),
 * on a device that didn't opt out (?no-analytics).
 *
 * @returns {boolean}
 */
export function analyticsAllowed() {
  if (!ANALYTICS_HOSTS.includes(window.location.hostname)) return false
  if (navigator.webdriver) return false
  if (new URLSearchParams(window.location.search).has('no-analytics')) return false
  try {
    if (window.localStorage.getItem(OPT_OUT_KEY) !== null) return false
  } catch {
    // Storage blocked: no opt-out could have been kept.
  }
  return true
}
