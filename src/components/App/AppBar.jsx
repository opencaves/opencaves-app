import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AppBar as MUIAppBar, Box, IconButton, Toolbar, Typography, Divider, List, ListItem, ListItemButton, ListItemText, Button, Drawer, styled, useTheme } from '@mui/material'
import { Grid } from '@mui/material'
import { MenuRounded } from '@mui/icons-material'
import { useSmall } from '@/hooks/useSmall.jsx'
import LogoIcon from './LogoIcon.jsx'
import AppMenu from './AppMenu.jsx'
import { appName, appTitle } from '@/config/app.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

const drawerWidth = 240
export default function AppBar(props) {
  const { window } = props
  const dispatch = useDispatch()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const theme = useTheme()
  const isSmall = useSmall(theme.breakpoints.down('md'))
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const canAccessDashboard = isLoggedIn && (roles.includes('editor') || roles.includes('admin'))
  const navItems = [{ key: 'home', to: '/' }, ...(canAccessDashboard ? [{ key: 'admin', to: '/dashboard' }] : []), { key: 'about', to: '/about' }]

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState)
  }

  function captureContinueUrl() {
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/signup')) {
      return
    }

    dispatch(setContinueUrl(buildContinueUrl(location)))
  }

  const StyledButton = styled(Button)({
    color: 'var(--md-palette-primary-contrastText)',
    whiteSpace: 'nowrap',
    borderColor: 'rgba(255 255 255 / 0.5)',
    ':hover': {
      borderColor: '#fff',
    },
  })

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2 }} noWrap>
        {appTitle}
      </Typography>
      <Divider />
      <List>
        {navItems.map(({ key, to }) => (
          <ListItem key={key} disablePadding>
            <ListItemButton component={Link} to={to} sx={{ textAlign: 'center' }}>
              <ListItemText primary={t(`${key}`, { name: appName })} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  const container = window !== undefined ? () => window().document.body : undefined

  return (
    <>
      <MUIAppBar className="oc-app-bar" component="nav">
        <Toolbar>
          {isSmall && (
            <IconButton color="inherit" aria-label={t('drawer.ariaLabel')} edge="start" onClick={handleDrawerToggle} sx={{ mr: { xs: 1, sm: 2 } }}>
              <MenuRounded />
            </IconButton>
          )}

          <Link to="/">
            <LogoIcon colorScheme="dark" sx={{ mr: 1 }} />
          </Link>

          <StyledButton
            variant="text"
            component={Link}
            to="/"
            sx={{
              mr: 2,
              p: 0,
            }}
          >
            <Typography
              variant="h6"
              noWrap
              sx={{
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {appTitle}
            </Typography>
          </StyledButton>

          <Grid container size="grow" sx={{ flexWrap: 'nowrap' }}>
            {!isSmall && (
              <Grid sx={{ mr: 1 }}>
                {navItems.map(({ key, to }) => (
                  <Button key={key} component={Link} to={to} sx={{ color: '#fff' }}>
                    {t(`${key}`, { name: appName })}
                  </Button>
                ))}
              </Grid>
            )}
            <Grid
              container
              sx={{
                flexWrap: 'nowrap',
                flexGrow: 1,
                justifyContent: 'flex-end',
              }}
            >
              {!isLoggedIn && (
                <>
                  <StyledButton variant="text" component={Link} to="/login" onClick={captureContinueUrl}>
                    {t('login')}
                  </StyledButton>
                  <StyledButton variant="outlined" component={Link} to="/signup" onClick={captureContinueUrl}>
                    {t('signup')}
                  </StyledButton>
                </>
              )}
              {isLoggedIn && (
                <AppMenu
                  logoColorScheme="dark"
                  disableElevation
                  sx={(theme) => ({
                    ml: 1,
                    width: theme.spacing(5),
                    height: theme.spacing(5),
                    minWidth: theme.spacing(5),
                    p: 0,
                    borderRadius: '50%',
                  })}
                />
              )}
            </Grid>
          </Grid>
        </Toolbar>
      </MUIAppBar>
      {isSmall && (
        <nav>
          <Drawer
            className="oc-app-bar--drawer"
            container={container}
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: isSmall, // Better open performance on mobile.
            }}
            sx={{
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
        </nav>
      )}
      <Toolbar />
    </>
  )
}
