// A horizontal strip of items (photos, videos, survey maps,
// .oc-media-strip--item): it scrolls freely - the wheel (scrollStrip), a
// swipe, its scrollbar - and once it has settled, glides to the item nearest
// its middle (snapOnSettle). The keyboard: centerFocused, leaveOnArrow on its
// content element. Not CSS scroll snapping: mandatory snapping made every
// wheel scroll jump from item to item.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A wheel's lines or pages as pixels.
const WHEEL_LINE = 16

// The wheel scrolls the strip sideways, by the wheel's own distance.
export function scrollStrip(view, event) {
  const delta = event.deltaY || event.deltaX
  const pixels = event.deltaMode === 1 ? delta * WHEEL_LINE : event.deltaMode === 2 ? delta * view.clientWidth : delta
  view.scrollLeft += pixels
}

// How long the strip stays still before it's settled.
const SETTLE_MS = 160

// The strip's items' centres, in its own scroll position (stacked half photos
// share one).
function itemCentres(view) {
  const viewLeft = view.getBoundingClientRect().left
  return [...view.querySelectorAll('.oc-media-strip--item')].map((item) => {
    const rect = item.getBoundingClientRect()
    return view.scrollLeft + (rect.left + rect.right) / 2 - viewLeft
  })
}

// Once still - no scroll for SETTLE_MS, and no scrollbar drag or touch going
// on - the strip glides to the item nearest its middle (the first and last as
// near as the strip's ends let them). Returns the cleanup. container: the
// element holding the strip and its scrollbar.
export function snapOnSettle(view, container) {
  if (!view || !container) return () => {}
  let timer
  let holding = false

  function snap() {
    if (holding) return
    const middle = view.scrollLeft + view.clientWidth / 2
    const centres = itemCentres(view)
    if (!centres.length) return
    const nearest = centres.reduce((best, centre) => (Math.abs(centre - middle) < Math.abs(best - middle) ? centre : best))
    const max = view.scrollWidth - view.clientWidth
    const left = Math.max(0, Math.min(max, nearest - view.clientWidth / 2))
    if (Math.abs(left - view.scrollLeft) >= 1) view.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  function settleLater() {
    clearTimeout(timer)
    timer = setTimeout(snap, SETTLE_MS)
  }
  function hold() {
    holding = true
    clearTimeout(timer)
  }
  function release() {
    if (!holding) return
    holding = false
    settleLater()
  }

  view.addEventListener('scroll', settleLater, { passive: true })
  // The scrollbar's thumb dragged (it lives in the container), a finger on the strip.
  container.addEventListener('pointerdown', hold)
  container.addEventListener('touchstart', hold, { passive: true })
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
  window.addEventListener('touchend', release)
  window.addEventListener('touchcancel', release)
  return () => {
    clearTimeout(timer)
    view.removeEventListener('scroll', settleLater)
    container.removeEventListener('pointerdown', hold)
    container.removeEventListener('touchstart', hold)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    window.removeEventListener('touchend', release)
    window.removeEventListener('touchcancel', release)
  }
}

// An item reached with the keyboard: scrolled to the middle of the strip
// (where the strip would settle anyway) - a click leaves it where it is.
// view: the strip's scrolling element.
export function centerFocused(event, view) {
  if (!view || !event.target.matches(':focus-visible')) return
  const viewRect = view.getBoundingClientRect()
  const itemRect = event.target.getBoundingClientRect()
  const offset = (itemRect.left + itemRect.right) / 2 - (viewRect.left + viewRect.right) / 2
  view.scrollTo({ left: view.scrollLeft + offset, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

// What Tab can reach.
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

const plainKey = (event, key) => event.key === key && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey

// The down arrow on one of its items: out of the strip, to the next element
// Tab can reach after it, the up arrow to the last one before it (instead of
// tabbing through every item). From there, the opposite arrow comes back to
// that item - until the focus moves elsewhere.
export function leaveOnArrow(event) {
  const down = plainKey(event, 'ArrowDown')
  if (!down && !plainKey(event, 'ArrowUp')) return
  const strip = event.currentTarget
  const item = event.target
  const side = down ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING
  const reachable = [...document.querySelectorAll(TABBABLE)].filter(
    (element) => strip.compareDocumentPosition(element) & side && !strip.contains(element) && element.tabIndex >= 0 && element.getClientRects().length > 0,
  )
  const target = down ? reachable[0] : reachable.at(-1)
  if (!target) return
  event.preventDefault()
  target.focus()

  function back(keyEvent) {
    if (!plainKey(keyEvent, down ? 'ArrowUp' : 'ArrowDown') || !item.isConnected) return
    keyEvent.preventDefault()
    item.focus()
  }
  target.addEventListener('keydown', back)
  target.addEventListener('blur', () => target.removeEventListener('keydown', back), { once: true })
}
