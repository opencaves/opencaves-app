import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar.jsx'
import LegalLinks from './LegalLinks.jsx'
import Dev from '../utils/Dev.jsx'
import { isMapPath } from '@/redux/slices/sessionSlice.jsx'
import { removeShell } from '@/utils/shell.js'
import './Layout.scss'

/**
 * The frame of every page but the map: the app bar, and the page's column on
 * the pages' background photo - translucent, its border the page's colour,
 * the photo in thin side margins on phones (Layout.scss), the Privacy and
 * Terms links at its foot. One frame for all (the error pages too), but for
 * the dashboard's home, whose window onto its own photo AdminDashboard draws.
 * The page's scroller: it keeps each page's position in the history, and
 * scrolls to an address's #section.
 */
export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  // (A trailing slash aside.) A page's gallery (…/photos/:id,
  // …/maps/:id[/edit]) counts as its page: nothing changes under it.
  const path = (location.pathname.replace(/\/+$/, '') || '/').replace(/\/(photos|maps)\/[^/]+(\/edit)?$/, '')
  // The dashboard's home: its own photo, and a transparent, square page -
  // AdminDashboard draws its window onto the photo, and its own Privacy and
  // Terms links.
  const isDashboardHome = path === '/dashboard'

  // index.html's splash goes once the page is here: the router renders this
  // with its page already loaded (lazy routes resolve first, under the
  // splash), and children's effects run before this one.
  useLayoutEffect(() => {
    removeShell()
  }, [])

  // This box, not the document, is the page's scroller (below), so the
  // router's scroll handling never reaches it: a new page opens at the top,
  // and back/forward returns to where that page was left. Each entry's
  // position is kept by its history key; the query (a page's tabs) keeps it.
  const scrollRef = useRef(null)
  const scrollPositions = useRef(new Map())
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return undefined
    const key = location.key
    const saved = navigationType === 'POP' ? scrollPositions.current.get(key) || 0 : 0
    // At once, not smoothly: a new page starts at its top.
    scroller.scrollTo({ top: saved, behavior: 'instant' })
    // A page coming back may still be loading, too short to scroll yet: try
    // again for a moment as it grows.
    let frame = null
    if (saved > 0) {
      const until = performance.now() + 1500
      const retry = () => {
        scroller.scrollTo({ top: saved, behavior: 'instant' })
        if (scroller.scrollTop < saved - 1 && performance.now() < until) frame = requestAnimationFrame(retry)
      }
      frame = requestAnimationFrame(retry)
    }
    const remember = () => scrollPositions.current.set(key, scroller.scrollTop)
    scroller.addEventListener('scroll', remember, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', remember)
    }
    // The page's address: its gallery opening or closing leaves it where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // An address with #section (the pages' sections have English ids: #photos,
  // #maps...): the page scrolls to it smoothly (the scroller's
  // scroll-behavior) once it's there and has stopped moving - what loads
  // above it (photos, maps, sections drawn as they near the screen) pushes it
  // down - then keeps it in place while the page settles, until the reader
  // scrolls. A # naming nothing is dropped from the address, as before.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!location.hash || isMapPath(location.pathname) || !scroller) return undefined
    const id = decodeURIComponent(location.hash.slice(1))
    const start = performance.now()
    let timer = null
    let stopped = false
    const stop = () => (stopped = true)
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    events.forEach((type) => scroller.addEventListener(type, stop, { passive: true }))
    // How far the section's top is from where scrolling to it puts it.
    const offset = (section) => section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - parseFloat(getComputedStyle(section).scrollMarginTop || '0')
    let last = null
    let still = 0
    const settle = () => {
      if (stopped) return
      const section = document.getElementById(id)
      if (!section) {
        if (performance.now() - start < 5000) timer = setTimeout(settle, 100)
        else navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
        return
      }
      const top = section.offsetTop
      still = top === last ? still + 1 : 0
      last = top
      // Still moving: wait (3 checks alike), a few seconds at most.
      if (still < 3 && performance.now() - start < 3000) {
        timer = setTimeout(settle, 100)
        return
      }
      section.scrollIntoView({ block: 'start' })
      const glidedAt = performance.now()
      const keep = () => {
        if (stopped || performance.now() - glidedAt > 2500) return
        const drift = offset(section)
        // After the glide, small moves are corrected at once.
        if (performance.now() - glidedAt > 700 && Math.abs(drift) > 4) scroller.scrollBy({ top: drift, behavior: 'instant' })
        timer = setTimeout(keep, 150)
      }
      timer = setTimeout(keep, 150)
    }
    settle()
    return () => {
      clearTimeout(timer)
      events.forEach((type) => scroller.removeEventListener(type, stop))
    }
  }, [location, navigate])

  return (
    <Box ref={scrollRef} className={['oc-layout', isDashboardHome && 'oc-layout--dashboard-home'].filter(Boolean).join(' ')}>
      <AppBar />
      {/* Its frame: Layout.scss. */}
      <Container id="main" className="oc-layout--main" component="main">
        <Outlet />
        {/* The Privacy and Terms links at every page's foot - not the landing
            page's, whose own footer has them, nor the dashboard home's, which
            has them in its own frame. */}
        {path !== '/' && !isDashboardHome && <LegalLinks sx={{ mt: 4, alignSelf: 'end' }} />}
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(64px + 1rem)' }} />
    </Box>
  )
}
