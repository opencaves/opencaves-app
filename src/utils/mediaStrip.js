// A horizontal strip of items (photos, videos, survey maps): its items rest
// in its middle - CSS scroll snapping (.oc-media-strip, .oc-media-strip--item
// in variables.scss) - reached with the wheel (scrollStrip), the keyboard
// (centerFocused, leaveOnArrow on its content element), a swipe or its
// scrollbar.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One wheel notch: a native scroll, which the snapping takes on to the next
// item that way (a step set by hand would be pulled back to the same one).
export function scrollStrip(view, direction) {
  view.scrollBy({ left: direction, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

// An item reached with the keyboard: scrolled to the middle of the strip,
// its snap position (the snapping alone takes the browser's scroll into view
// to the nearest one, not always its own) - a click leaves it where it is.
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
