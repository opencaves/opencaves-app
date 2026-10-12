// Page transitions (the View Transitions API, through React Router's
// `viewTransition`): M3's shared axis between a page and the pages under it
// (a list and a cave's or a system's page: forward, back), fade through
// between unrelated pages (the menu's). Not within a page (a filter, an
// anchor), on the map (each pin would animate the whole screen), nor into
// or out of what opens over a page (its photos, maps, edit form). The motion
// is CSS (pageTransitions.scss), keyed by <html data-oc-transition>; a
// browser without the API changes pages as before.

// What opens over a page (galleries, viewers, edit forms): no transition.
const OVERLAY = /\/(photos|maps|videos|medias|edit)(\/|$)/
const isMap = (path) => path === '/map' || path.startsWith('/map/')
const depth = (path) => path.split('/').filter(Boolean).length

/**
 * The transition between two addresses' paths: 'forward' (deeper, as a
 * list to one of its items), 'back' (up), 'fade' (elsewhere), or null (none).
 *
 * @param {string} from
 * @param {string} to
 * @returns {'forward'|'back'|'fade'|null}
 */
export function transitionBetween(from, to) {
  if (from === to) return null
  if ((isMap(from) && isMap(to)) || OVERLAY.test(from) || OVERLAY.test(to)) return null
  const [a, b] = [from.split('/').filter(Boolean), to.split('/').filter(Boolean)]
  // Same first segment (/caves and /caves/:id, /sistemas...): one axis.
  if (a[0] && a[0] === b[0]) return depth(to) > depth(from) ? 'forward' : 'back'
  return 'fade'
}

/**
 * Animates the router's navigations ({@link transitionBetween}): its
 * navigate - the links', useNavigate's - asks React Router for a view
 * transition and tells the CSS which; the browser's back button plays the
 * shared axis backward. Browser only (the server renders with its own router).
 *
 * @param {import('react-router-dom').DataRouter} router
 * @returns {import('react-router-dom').DataRouter} The same router.
 */
export function withPageTransitions(router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return router
  const root = document.documentElement
  const navigate = router.navigate.bind(router)
  router.navigate = /** @type {typeof router.navigate} */ ((to, options) => {
    if (typeof to === 'number') {
      root.dataset.ocTransition = to < 0 ? 'back' : 'forward'
      return navigate(to, options)
    }
    const from = router.state.location.pathname
    const path = typeof to === 'string' ? new URL(to, window.location.href).pathname : to?.pathname ?? from
    const kind = transitionBetween(from, path)
    if (!kind) return navigate(to, options)
    root.dataset.ocTransition = kind
    // After its options: a link passes viewTransition: undefined.
    return navigate(to, { ...options, viewTransition: options?.viewTransition ?? true })
  })
  // The browser's back and forward buttons: back, mostly.
  window.addEventListener('popstate', () => {
    root.dataset.ocTransition = 'back'
  })
  return router
}
