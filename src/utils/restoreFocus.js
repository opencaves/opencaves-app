// Giving the focus back when a dialog or menu closes. MUI's own way (its
// FocusTrap) focuses the opener the moment it closes, while the page (#root)
// is still aria-hidden - until the closing transition has ended for a dialog,
// an effect later for a menu: Chrome blocks it ("Blocked aria-hidden on an
// element because its descendant retained focus"). So the theme turns that
// off (MuiModal's disableRestoreFocus, Theme.jsx), and the focus is given
// back here, once the page is no longer hidden.

/**
 * Gives the focus back to what had it in the page when a dialog or menu
 * hid it (MUI's modals: #root aria-hidden), once the page is shown again -
 * unless something in the page has taken it meanwhile. Nested modals: when
 * the last one closes.
 * Browser only, called once at startup.
 */
export function watchFocusRestore() {
  const root = document.getElementById('root')
  if (!root) return
  // What had the focus in the page as it left for something outside it (a
  // modal taking it, before or after hiding the page).
  let leftFrom = null
  document.addEventListener('focusin', (event) => {
    const target = /** @type {Node} */ (event.target)
    if (root.contains(target)) leftFrom = null
    else if (event.relatedTarget instanceof HTMLElement && root.contains(event.relatedTarget)) leftFrom = event.relatedTarget
  })

  let hidden = root.getAttribute('aria-hidden') === 'true'
  let opener = null
  new MutationObserver(() => {
    const nowHidden = root.getAttribute('aria-hidden') === 'true'
    if (nowHidden === hidden) return
    hidden = nowHidden
    if (hidden) {
      const active = document.activeElement
      opener = active && active !== root && root.contains(active) ? active : leftFrom
      return
    }
    const target = /** @type {HTMLElement} */ (opener)
    opener = null
    // Nothing in the page has it (the body, or the closing menu still).
    if (target?.isConnected && !root.contains(document.activeElement)) target.focus({ preventScroll: true })
  }).observe(root, { attributes: true, attributeFilter: ['aria-hidden'] })
}
