import { useEffect, useRef } from 'react'

// The swap's timing (MD3's carousel guidelines): emphasized easing, long
// duration.
const SWAP = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A full-screen pane's entrance and exit on phones (Show all's, Further
 * reading's): the two screens swap side by side - the page (#root) squeezes
 * toward its start edge, shrinking in width, as the pane grows in from the
 * end edge; back, the reverse. With reduced motion, or `enabled` false, none.
 * The pane is a MUI Dialog: give its paper `paperRef` and call `enter` from
 * its transition's onEntering (once its content is in the page); `close`
 * plays the way back, then calls `onClosed`.
 *
 * @param {boolean} enabled - Phones: the swap; elsewhere the dialog's own transition.
 * @returns {{swap: boolean, paperRef: import('react').RefObject<HTMLElement>, enter: () => void, close: (onClosed: () => void) => void}}
 */
export function usePaneSwap(enabled) {
  const swap = enabled && !prefersReducedMotion()
  const paperRef = useRef(/** @type {HTMLElement|null} */ (null))
  const animations = useRef(/** @type {Animation[]} */ ([]))
  const closingRef = useRef(false)

  // The swap, one way: the page (the app, outside the dialog's portal) and
  // the pane, each squeezed from its own edge.
  function animateSwap(forward) {
    const page = document.getElementById('root')
    const pane = paperRef.current
    animations.current.forEach((animation) => animation.cancel())
    if (!page || !pane) return (animations.current = [])
    const direction = forward ? 'normal' : 'reverse'
    animations.current = [
      page.animate([{ transformOrigin: '0 50%', transform: 'none' }, { transformOrigin: '0 50%', transform: 'scaleX(0)' }], { ...SWAP, direction, fill: 'both' }),
      pane.animate([{ transformOrigin: '100% 50%', transform: 'scaleX(0)' }, { transformOrigin: '100% 50%', transform: 'none' }], { ...SWAP, direction, fill: 'both' }),
    ]
    return animations.current
  }
  // Leaving the page (an item opened) with the pane open: the page back.
  useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), [])

  function close(onClosed) {
    if (!swap) return onClosed()
    if (closingRef.current) return
    closingRef.current = true
    const [pageAnimation, paneAnimation] = animateSwap(false)
    Promise.all([pageAnimation, paneAnimation].map((animation) => animation?.finished.catch(() => {}))).then(() => {
      // The page's animation ends where it started: dropping it changes
      // nothing. The pane's stays (squeezed to nothing) until the pane is
      // gone - dropping it first would show the pane again for a frame.
      pageAnimation?.cancel()
      animations.current = paneAnimation ? [paneAnimation] : []
      closingRef.current = false
      onClosed()
    })
  }

  return { swap, paperRef, enter: () => animateSwap(true), close }
}
