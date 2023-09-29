import { Outlet } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import AppBar from './AppBar'
import Dev from '../utils/Dev'

export default function Layout() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}
    >
      <AppBar />
      <Container component='main' sx={{ py: 2, display: 'grid', flexGrow: '1' }}>
        <Outlet />
      </Container>

      <Dev sx={{ '--oc-mode-switcher-top': 'calc(56px + 1rem)' }} />
    </Box>
  )
}