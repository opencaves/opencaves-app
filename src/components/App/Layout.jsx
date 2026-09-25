import { Outlet } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar.jsx'
import Dev from '../utils/Dev.jsx'

export default function Layout() {
  return (
    <Box
      className="oc-layout"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}
    >
      <AppBar />
      <Container className="oc-layout--main" component='main' sx={{ py: 2, display: 'grid', flexGrow: '1' }}>
        <Outlet />
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(56px + 1rem)' }} />
    </Box>
  )
}