import { useEffect } from 'react'

// A gallery's left and right arrow keys: the previous and next picture,
// wherever the focus is on the page (the lightbox only listened while it had
// focus itself, which it never got) - but not while typing in a field, moving
// a slider, or with a menu or dialog open over the gallery.
// controllerRef: the lightbox's controller ref (prev, next).
export function useGalleryArrowKeys(controllerRef) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target
      if (target.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"], [role="menu"], [role="listbox"], [role="dialog"], [role="tablist"]')) return
      if (document.querySelector('.MuiModal-root:not(.MuiModal-hidden) [role="menu"], .MuiDialog-root')) return
      const controller = controllerRef.current
      if (!controller) return
      event.preventDefault()
      // Right goes forward in left-to-right languages.
      const forward = (event.key === 'ArrowRight') === (document.dir !== 'rtl')
      if (forward) controller.next()
      else controller.prev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controllerRef])
}
