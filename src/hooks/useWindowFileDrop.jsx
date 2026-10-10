import { useCallback, useEffect, useRef, useState } from 'react'
import { isExternalFileDrag } from '@/utils/externalFileDrag.js'

/**
 * Files dragged anywhere over the window (not just onto a drop zone), while
 * `enabled`: [open, close] for the full-screen drop zone (Dropzone) - open
 * while files from outside the page are over it, close once dropped. The
 * window, not an element: it covers everything (the map too, outside the
 * result pane's own DOM). The enter/leave counter: the browser fires
 * dragenter/dragleave for every element the pointer passes over.
 *
 * @param {boolean} [enabled=true]
 * @returns {[boolean, () => void]} [open, close].
 */
export function useWindowFileDrop(enabled = true) {
  const [open, setOpen] = useState(false)
  const counter = useRef(0)
  const close = useCallback(() => {
    counter.current = 0
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined

    // Files from outside the page only: dragging one of its own pictures
    // (a gallery thumbnail) isn't adding one.
    function onDragEnter(event) {
      if (!isExternalFileDrag(event)) return
      event.preventDefault()
      counter.current += 1
      setOpen(true)
    }

    function onDragOver(event) {
      if (isExternalFileDrag(event)) event.preventDefault()
    }

    function onDragLeave() {
      if (counter.current === 0) return
      counter.current -= 1
      if (counter.current <= 0) close()
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', close)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', close)
    }
  }, [enabled, close])

  return [open, close]
}
