import { useEffect, useState } from 'react'
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
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'

const drawerWidth = 240
const referenceDataItemPath = new RegExp(`^/(?:${Object.keys(REFERENCE_DATA_CONFIGS).join('|')})/[^/]+/edit$`)
export default function AppBar(props) {
  const { window } = props
  const dispatch = useDispatch()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [entityHeadingHidden, setEntityHeadingHidden] = useState(false)
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const theme = useTheme()
  const isSmall = useSmall(theme.breakpoints.down('md'))
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const pageTitle = useSelector((state) => state.app.title)
  const isNamedEditPage = /^\/(?:caves|sistemas|connections)\/[^/]+\/edit$/.test(location.pathname) || referenceDataItemPath.test(location.pathname)
  const pageTitleSuffix = ` / ${appTitle}`
  const entityTitle = pageTitle?.endsWith(pageTitleSuffix) ? pageTitle.slice(0, -pageTitleSuffix.length) : ''
  const toolbarTitle = isNamedEditPage && entityHeadingHidden && entityTitle ? entityTitle : appTitle
  const canAccessDashboard = isLoggedIn && (roles.includes('editor') || roles.includes('admin'))
  const navItems = [{ key: 'home', to: '/' }, ...(canAccessDashboard ? [{ key: 'admin', to: '/dashboard' }] : []), { key: 'about', to: '/about' }]

  useEffect(() => {
    setEntityHeadingHidden(false)
    if (!isNamedEditPage) return undefined

    const scrollRoot = document.querySelector('.oc-layout')
    if (!scrollRoot) return undefined

    let observedHeading = null
    const intersectionObserver = new IntersectionObserver(([entry]) => setEntityHeadingHidden(!entry.isIntersecting), { root: scrollRoot, rootMargin: '-64px 0px 0px 0px', threshold: 0 })
    const observeHeading = () => {
      const heading = scrollRoot.querySelector('[data-appbar-page-title]')
      if (heading && heading !== observedHeading) {
        if (observedHeading) intersectionObserver.unobserve(observedHeading)
        observedHeading = heading
        intersectionObserver.observe(heading)
      }
    }
    const mutationObserver = new MutationObserver(observeHeading)

    observeHeading()
    mutationObserver.observe(scrollRoot, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [isNamedEditPage])

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
      <MUIAppBar className="oc-app-bar" component="nav" aria-label={t('navMain')}>
        <Toolbar>
          {isSmall && (
            <IconButton color="inherit" aria-label={t('drawer.ariaLabel')} edge="start" onClick={handleDrawerToggle} sx={{ mr: { xs: 1, sm: 2 } }}>
              <MenuRounded />
            </IconButton>
          )}

          {/* Same destination as the title link beside it: hidden from
              assistive tech and the tab order instead of a second,
              text-less link. */}
          <Link to="/" aria-hidden="true" tabIndex={-1}>
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
              key={toolbarTitle}
              variant="h6"
              noWrap
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                '@keyframes appbar-title-enter': {
                  from: { opacity: 0, transform: 'translateY(4px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
                animation: 'appbar-title-enter 180ms ease-out',
              }}
            >
              {toolbarTitle}
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
        <nav aria-label={t('navDrawer')}>
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
