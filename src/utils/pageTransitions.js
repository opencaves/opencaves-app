// Page transitions (the View Transitions API, through React Router's
// `viewTransition`): M3's shared axis between a page and the pages under it
// (a list and a cave's or a system's page: forward, back), fade through
// between unrelated pages (the menu's). Not within a page (a filter, an
// anchor), on the map (each pin would animate the whole screen), nor into
// or out of what opens over a page (its maps, edit form) - except a photo:
// M3's container transform, its thumbnail growing into the gallery
// (expand) and the gallery shrinking back into it (collapse). The motion
// is CSS (pageTransitions.scss), keyed by <html data-oc-transition>; a
// browser without the API changes pages as before.

// What opens over a page (galleries, viewers, edit forms): no transition -
// but a photo opened over its page, or closed back to it (PHOTO).
const OVERLAY = /\/(photos|maps|videos|medias|edit)(\/|$)/
const isMap = (path) => path === '/map' || path.startsWith('/map/')
const depth = (path) => path.split('/').filter(Boolean).length
// A photo opened over its page: <page>/photos/<id>.
const PHOTO = /^(.*)\/photos\/([^/]+)\/?$/

/**
 * The photo a path opens over its page, if it is one.
 *
 * @param {string} path
 * @returns {{ page: string, id: string } | null}
 */
function photoOf(path) {
  const match = PHOTO.exec(path)
  return match && { page: match[1] || '/', id: match[2] }
}

/**
 * The transition between two addresses' paths: 'forward' (deeper, as a
 * list to one of its items), 'back' (up), 'fade' (elsewhere), 'expand' and
 * 'collapse' (a photo opened over its page, closed back to it), or null (none).
 *
 * @param {string} from
 * @param {string} to
 * @returns {'forward'|'back'|'fade'|'expand'|'collapse'|null}
 */
export function transitionBetween(from, to) {
  if (from === to) return null
  if (photoOf(to)?.page === from) return 'expand'
  if (photoOf(from)?.page === to) return 'collapse'
  if ((isMap(from) && isMap(to)) || OVERLAY.test(from) || OVERLAY.test(to)) return null
  const [a, b] = [from.split('/').filter(Boolean), to.split('/').filter(Boolean)]
  // Same first segment (/caves and /caves/:id, /sistemas...): one axis.
  if (a[0] && a[0] === b[0]) return depth(to) > depth(from) ? 'forward' : 'back'
  return 'fade'
}

// A photo on a 3D strip (MediaStrip): its link is hidden under the slices
// drawn for it, and turned in 3D with the cylinder - the photo would grow out
// of a card turned sideways, partly outside the strip (and the link isn't
// even where its photo shows). Instead a flat copy of it over the part shown
// (its slices' box on screen, within the strip's viewing area), invisible
// but while a transition runs (the CSS), removed once it has. Elsewhere, or
// with no image, the link itself.
function standInFor(link) {
  const strip = link.closest('.oc-media-strip')
  const image = /** @type {HTMLImageElement} */ (link.querySelector('img'))
  if (!strip || !image?.currentSrc) return link
  const stage = strip.querySelector('.oc-media-strip--cylinder') ?? strip
  const view = stage.getBoundingClientRect()
  // Its slices (each painting a strip of its image), those turned towards us.
  const boxes = [...stage.querySelectorAll('div')]
    .filter((slice) => slice.style.backgroundImage.includes(image.currentSrc) && getComputedStyle(slice).visibility !== 'hidden')
    .map((slice) => slice.getBoundingClientRect())
    .filter((rect) => rect.width > 0)
  // Not drawn as slices (no cylinder): the link's box.
  const box = !boxes.length
    ? link.getBoundingClientRect()
    : new DOMRect(Math.min(...boxes.map((r) => r.left)), Math.min(...boxes.map((r) => r.top)), 0, 0)
  if (boxes.length) {
    box.width = Math.max(...boxes.map((r) => r.right)) - box.left
    box.height = Math.max(...boxes.map((r) => r.bottom)) - box.top
  }
  const left = Math.max(box.left, view.left)
  const top = Math.max(box.top, view.top)
  const width = Math.min(box.right, view.right) - left
  const height = Math.min(box.bottom, view.bottom) - top
  if (width <= 0 || height <= 0) return null
  // The part shown: the whole photo's box, clipped to the strip.
  const standIn = document.createElement('div')
  standIn.className = 'oc-photo-stand-in'
  Object.assign(standIn.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, overflow: 'hidden', borderRadius: '0.5rem', pointerEvents: 'none', zIndex: '1' })
  const copy = document.createElement('img')
  copy.crossOrigin = image.crossOrigin
  copy.src = image.currentSrc
  copy.alt = ''
  Object.assign(copy.style, { position: 'absolute', left: `${box.left - left}px`, top: `${box.top - top}px`, width: `${box.width}px`, height: `${box.height}px`, objectFit: 'cover', maxWidth: 'none' })
  standIn.append(copy)
  document.body.append(standIn)
  removeWhenDone(standIn)
  return standIn
}

// Removes a stand-in once the transition it's for has run (or, never
// started, after a while).
function removeWhenDone(element) {
  const until = performance.now() + 3000
  let seen = false
  const check = () => {
    let active = false
    try {
      active = document.documentElement.matches(':active-view-transition')
    } catch {
      // A browser that can't tell: the time limit.
    }
    seen ||= active
    if ((seen && !active) || performance.now() > until) element.remove()
    else requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

// The thumbnail a photo grows from and shrinks back into: its link on the
// page (or its stand-in, {@link standInFor}), marked [data-oc-shared] (named
// in the CSS while no gallery is open, so it and the gallery never hold the
// name together). Among its links (the strip's, Show all's): the one on top,
// else the last one on screen.
function markThumbnail(id) {
  for (const marked of document.querySelectorAll('[data-oc-shared]')) delete (/** @type {HTMLElement} */ (marked).dataset.ocShared)
  for (const standIn of document.querySelectorAll('.oc-photo-stand-in')) standIn.remove()
  if (!id) return
  const onScreen = [...document.querySelectorAll(`a[href$="/photos/${CSS.escape(id)}"]`)].filter((link) => {
    const { top, bottom, left, right } = link.getBoundingClientRect()
    return bottom > 0 && right > 0 && top < window.innerHeight && left < window.innerWidth && right > left
  })
  const onTop = onScreen.find((link) => {
    const { top, bottom, left, right } = link.getBoundingClientRect()
    return link.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))
  })
  const link = onTop ?? onScreen.at(-1)
  const thumbnail = link && standInFor(link)
  if (thumbnail) thumbnail.dataset.ocShared = ''
}

/**
 * Animates the router's navigations ({@link transitionBetween}): its
 * navigate - the links', useNavigate's - asks React Router for a view
 * transition and tells the CSS which (a photo's: its thumbnail marked);
 * the browser's back and forward buttons play theirs too. Browser only (the
 * server renders with its own router).
 *
 * @param {import('react-router-dom').DataRouter} router
 * @returns {import('react-router-dom').DataRouter} The same router.
 */
export function withPageTransitions(router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return router
  const root = document.documentElement
  // The path shown, and the one before (the router may have moved on to
  // the new address by the time its popstate reaches us).
  let current = router.state.location.pathname
  let previous = current
  router.subscribe((state) => {
    if (state.location.pathname === current) return
    previous = current
    current = state.location.pathname
  })
  // Tells the CSS the kind; a photo's marks its thumbnail (any other, none).
  const prepare = (from, to) => {
    const kind = transitionBetween(from, to)
    if (kind) root.dataset.ocTransition = kind
    markThumbnail(kind === 'expand' ? photoOf(to).id : kind === 'collapse' ? photoOf(from).id : null)
    return kind
  }
  const navigate = router.navigate.bind(router)
  router.navigate = /** @type {typeof router.navigate} */ ((to, options) => {
    // A step in the history (a gallery closed with a step back): React
    // Router plays the transition its way in, so the kind from its path.
    if (typeof to === 'number') {
      if (to < 0 && photoOf(current)) prepare(current, photoOf(current).page)
      else root.dataset.ocTransition = to < 0 ? 'back' : 'forward'
      return navigate(to, options)
    }
    const from = router.state.location.pathname
    const path = typeof to === 'string' ? new URL(to, window.location.href).pathname : to?.pathname ?? from
    if (!prepare(from, path)) return navigate(to, options)
    // After its options: a link passes viewTransition: undefined.
    return navigate(to, { ...options, viewTransition: options?.viewTransition ?? true })
  })
  // The browser's back and forward buttons: their way, back if unknown.
  window.addEventListener('popstate', () => {
    const to = window.location.pathname
    if (!prepare(current === to ? previous : current, to)) root.dataset.ocTransition = 'back'
  })
  return router
}
