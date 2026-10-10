import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Box, Modal } from '@mui/material'

// How long the viewer has to show its Back button (it loads the list first).
const AUTOFOCUS_WAIT_MS = 2000

/**
 * A page's gallery (PhotoGallery, MapGallery): over the whole window, above
 * the page it belongs to, which stays under it. A modal: focus kept inside,
 * the page hidden from screen readers and still, Escape closes it.
 * Keyboard: the focus starts on the viewer's Back button ([data-oc-autofocus]),
 * Escape closes it from anywhere inside (the lightbox keeps its keys to
 * itself), and closing it gives the focus back - to returnFocus() (e.g. the
 * photo last shown on the page), or to what opened it.
 */
export default function GalleryOverlay({ className, onClose, returnFocus, children }) {
  // Opened once the link that led here has let go of focus: the modal hides
  // the page (aria-hidden on #root) before taking focus, which the browser
  // blocks while that link still has it.
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const content = useRef(null)
  useLayoutEffect(() => {
    opener.current = document.activeElement
    const focused = /** @type {HTMLElement} */ (document.activeElement)
    focused?.blur()
    setOpen(true)
  }, [])

  // The latest callbacks, for the listeners and the cleanup below.
  const latest = useRef({ onClose, returnFocus })
  latest.current = { onClose, returnFocus }

  useEffect(() => {
    if (!open) return undefined
    const until = performance.now() + AUTOFOCUS_WAIT_MS
    let frame
    const focusBack = () => {
      const button = content.current?.querySelector('[data-oc-autofocus]')
      if (button) button.focus()
      else if (performance.now() < until) frame = requestAnimationFrame(focusBack)
    }
    frame = requestAnimationFrame(focusBack)

    // Capture: before the lightbox, which stops it. Only from inside the
    // viewer: a menu or dialog over it (its own portal) closes itself first.
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !content.current?.contains(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      latest.current.onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  // Closed: the focus back on the page, once the modal has let go of it.
  useEffect(
    () => () => {
      const target = latest.current.returnFocus?.() || opener.current
      setTimeout(() => {
        if (target?.isConnected) target.focus({ preventScroll: false })
      })
    },
    [],
  )

  return (
    <Modal className={['oc-gallery-overlay', className].filter(Boolean).join(' ')} open={open} onClose={onClose} slotProps={{ backdrop: { sx: { bgcolor: '#000' } } }}>
      <Box ref={content} className="oc-gallery-overlay--content" sx={{ position: 'fixed', inset: 0, display: 'flex', bgcolor: '#000', outline: 'none' }}>
        {children}
      </Box>
    </Modal>
  )
}
