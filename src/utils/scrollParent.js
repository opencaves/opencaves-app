/**
 * The nearest ancestor of `element` that scrolls vertically (overflow-y auto,
 * scroll or overlay), else the window.
 *
 * @param {Element} element
 * @returns {Element|Window}
 */
export function findScrollParent(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY)) return parent
  }
  return window
}
