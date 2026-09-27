import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar.jsx'
import Dev from '../utils/Dev.jsx'
import { isMapPath } from '@/redux/slices/sessionSlice.jsx'
import layoutBackground from '@/images/404/bg.webp'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

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
        backgroundColor: '#000',
        backgroundImage: `url(${layoutBackground})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <AppBar />
      <Container className="oc-layout--main" component="main" sx={{ py: 2, display: 'grid', flexGrow: '1', bgcolor: '#fff', border: { xs: '0.5rem solid #fff', sm: '1rem solid #fff' }, borderRadius: '4px' }}>
        <Outlet />
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(56px + 1rem)' }} />
    </Box>
  )
}
