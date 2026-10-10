import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box } from '@mui/material'

// How long a new page has to show its heading (they load their data first).
const HEADING_WAIT_MS = 3000

// Read by screen readers, not shown.
const VISUALLY_HIDDEN = { position: 'absolute', width: 1, height: 1, p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }

/**
 * Keyboard and screen-reader users after an in-app navigation: the focus
 * left on <body> (the link they used is gone) moves to the new page's h1, which
 * screen readers read. When the focus is still somewhere (the app bar's links,
 * its search), it stays there and the new page's title is announced instead.
 */
export default function RouteFocus() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = useState('')
  const first = useRef(true)

  useEffect(() => {
    // The first page: the browser's own load already announces it.
    if (first.current) {
      first.current = false
      return undefined
    }
    // The last page's title isn't left behind.
    setAnnouncement('')
    const until = performance.now() + HEADING_WAIT_MS
    let frame
    const lost = () => !document.activeElement || document.activeElement === document.body
    const look = () => {
      const heading = [...document.querySelectorAll('main h1, h1')].find((h1) => h1.offsetParent && h1.textContent.trim())
      if (heading && lost()) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
      } else if (heading || performance.now() >= until) {
        setAnnouncement(document.title)
      } else {
        frame = requestAnimationFrame(look)
      }
    }
    // After the page has rendered and set its title.
    frame = requestAnimationFrame(look)
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <Box className="oc-route-focus" aria-live="polite" aria-atomic="true" sx={VISUALLY_HIDDEN}>
      {announcement}
    </Box>
  )
}
