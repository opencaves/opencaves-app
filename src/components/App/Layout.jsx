import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar.jsx'
import Dev from '../utils/Dev.jsx'
import { isMapPath } from '@/redux/slices/sessionSlice.jsx'
import layoutBackground from '@/images/404/bg.webp'
import dashboardBackground from '@/images/dashboard/bg.webp'
import pagesBackground from '@/images/pages/bg.webp'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'
import { isPublicIndexPath } from '@/utils/seo.js'

// First URL segment of every dashboard (admin) page - see router.jsx. Some
// of them also hold public pages (/caves, /sistemas/<id>, /areas/<slug>...),
// which look like the site's other pages (isPublicIndexPath).
const DASHBOARD_SECTIONS = new Set(['dashboard', 'caves', 'sistemas', 'connections', 'users', 'audits', ...Object.keys(REFERENCE_DATA_CONFIGS)])

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  // (A trailing slash aside.) A page's gallery (…/photos/:id,
  // …/maps/:id[/edit]) counts as its page: nothing changes under it.
  const path = (location.pathname.replace(/\/+$/, '') || '/').replace(/\/(photos|maps)\/[^/]+(\/edit)?$/, '')
  const isDashboardPage = DASHBOARD_SECTIONS.has(path.split('/')[1]) && !isPublicIndexPath(path)
  // A cenote entrance's stairs behind About, the cave and cave system lists
  // and the reference data pages (lists and forms; not the public area pages).
  const isReferenceDataPage = Object.hasOwn(REFERENCE_DATA_CONFIGS, path.split('/')[1]) && !isPublicIndexPath(path)
  // The cave and cave system lists and pages too, translucent like them,
  // their sections on cards.
  const isSistemaPage = /^\/(sistemas|caves)(\/(?!edit$)[^/]+)?$/.test(path)
  // A cave's or system's edit page: its page's background.
  const isItemEditPage = /^\/(sistemas|caves)\/(?!edit$)[^/]+\/edit$/.test(path)
  const hasPagesBackground = ['/about', '/caves', '/sistemas'].includes(path) || isReferenceDataPage || isSistemaPage || isItemEditPage
  // The dashboard home's page is transparent: its white margins are drawn by
  // AdminDashboard itself, around a window onto this background image. The
  // pages it leads to (the map layers too) are translucent, as its own card.
  const isDashboardHome = location.pathname === '/dashboard'
  // ...and a cave system's public page, whose sections stand on cards.
  const isTranslucentPage = isDashboardPage || location.pathname.split('/')[1] === 'map-layers' || isSistemaPage
  // Phones, dashboard sub-pages and the account page: side margins showing
  // the background image instead of the page's white side borders (margins
  // rather than transparent borders, whose corners would join the top/bottom
  // borders diagonally).
  const sideBordersSeeThrough = (isDashboardPage && !isDashboardHome) || isSistemaPage || location.pathname === '/account'

  useEffect(() => {
    if (location.hash && !isMapPath(location.pathname)) {
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
    }
  }, [location, navigate])

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
    scroller.scrollTop = saved
    // A page coming back may still be loading, too short to scroll yet: try
    // again for a moment as it grows.
    let frame = null
    if (saved > 0) {
      const until = performance.now() + 1500
      const retry = () => {
        scroller.scrollTop = saved
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

  return (
    <Box
      ref={scrollRef}
      className="oc-layout"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // #root itself is pinned to the viewport with overflow-y hidden
        // (disable-pull-to-refresh.scss, needed for the full-screen /map
        // page's own internal scroll areas) - so any Layout-based page
        // taller than the viewport needs to be its own scroll container,
        // not rely on the document/body to scroll.
        height: '100%',
        overflowY: 'auto',
        // Never sideways: every page fits the width (wide content, like the
        // connections table, scrolls within itself), and anything poking a
        // few pixels past the edge brought a horizontal scrollbar - which,
        // with the vertical one, shrank the background image.
        overflowX: 'hidden',
        // Keep the scrollbar's room even when there's nothing to scroll: a
        // page's height changes as it loads (skeleton, then content), and a
        // scrollbar coming and going resized this box - rescaling and
        // shifting its cover background image with it.
        scrollbarGutter: 'stable',
        backgroundColor: '#000',
        backgroundImage: `url(${hasPagesBackground ? pagesBackground : isDashboardPage ? dashboardBackground : layoutBackground})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <AppBar />
      {/* One column, never wider than the page (sized by its content, a
          wide form pushed the page past the screen's edge on phones). */}
      <Container className="oc-layout--main" component="main" sx={{ py: 2, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', flexGrow: '1', bgcolor: isDashboardHome ? 'transparent' : isTranslucentPage ? 'var(--oc-page-surface-translucent)' : 'var(--oc-page-surface)', border: { xs: '0.5rem solid var(--oc-page-surface)', sm: '1rem solid var(--oc-page-surface)' }, ...(sideBordersSeeThrough && { borderLeftWidth: { xs: 0, sm: '1rem' }, borderRightWidth: { xs: 0, sm: '1rem' }, mx: { xs: '0.5rem', sm: 'auto' }, width: { xs: 'auto', sm: '100%' } }), // Square on the dashboard home, whose frame AdminDashboard draws.
        borderRadius: isDashboardHome ? 0 : sideBordersSeeThrough ? { xs: 0, sm: '4px' } : '4px' }}>
        <Outlet />
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(64px + 1rem)' }} />
    </Box>
  )
}
