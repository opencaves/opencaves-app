import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar.jsx'
import Dev from '../utils/Dev.jsx'
import { isMapPath } from '@/redux/slices/sessionSlice.jsx'
import layoutBackground from '@/images/404/bg.webp'
import dashboardBackground from '@/images/dashboard/bg.webp'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'

// First URL segment of every dashboard (admin) page - see router.jsx.
const DASHBOARD_SECTIONS = new Set(['dashboard', 'caves', 'sistemas', 'connections', 'users', ...Object.keys(REFERENCE_DATA_CONFIGS)])

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboardPage = DASHBOARD_SECTIONS.has(location.pathname.split('/')[1])
  // The dashboard home's page is transparent: its white margins are drawn by
  // AdminDashboard itself, around a window onto this background image.
  const isDashboardHome = location.pathname === '/dashboard'
  // Phones, dashboard sub-pages and the account page: side margins showing
  // the background image instead of the page's white side borders (margins
  // rather than transparent borders, whose corners would join the top/bottom
  // borders diagonally).
  const sideBordersSeeThrough = (isDashboardPage && !isDashboardHome) || location.pathname === '/account'

  useEffect(() => {
    if (location.hash && !isMapPath(location.pathname)) {
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
    }
  }, [location, navigate])

  return (
    <Box
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
        backgroundImage: `url(${isDashboardPage ? dashboardBackground : layoutBackground})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <AppBar />
      <Container className="oc-layout--main" component="main" sx={{ py: 2, display: 'grid', flexGrow: '1', bgcolor: isDashboardHome ? 'transparent' : '#fff', border: { xs: '0.5rem solid #fff', sm: '1rem solid #fff' }, ...(sideBordersSeeThrough && { borderLeftWidth: { xs: 0, sm: '1rem' }, borderRightWidth: { xs: 0, sm: '1rem' }, mx: { xs: '0.5rem', sm: 'auto' }, width: { xs: 'auto', sm: '100%' } }), borderRadius: sideBordersSeeThrough ? { xs: 0, sm: '4px' } : '4px' }}>
        <Outlet />
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(56px + 1rem)' }} />
    </Box>
  )
}
