import { Fragment, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AppBar as MUIAppBar, Box, IconButton, Toolbar, Typography, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Button, Drawer, SvgIcon, styled, useTheme } from '@mui/material'
import { Grid } from '@mui/material'
import MenuRounded from '@mui/icons-material/MenuRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import InfoRounded from '@mui/icons-material/InfoRounded'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import CaveIcon from '@/images/map/cave.svg?react'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import { useSmall } from '@/hooks/useSmall.jsx'
import LogoIcon from './LogoIcon.jsx'
import AppMenu from './AppMenu.jsx'
import { APP_NAME, APP_TITLE } from '@/config/app.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'

const drawerWidth = 240
const referenceDataItemPath = new RegExp(`^/(?:${Object.keys(REFERENCE_DATA_CONFIGS).join('|')})/[^/]+/edit$`)
// Module level, not inside AppBar: a styled() component made during render
// is a new component type every render, so React remounted the title button
// each time - replaying the title's enter animation (a flicker).
// The bar's links: white text, and Material Design 3's state layers in the
// same white (hover 8%, focus and pressed 10%) - MUI's default tint is a
// shade of the bar's own primary colour, invisible on it.
const NAV_LINK_SX = {
  color: '#fff',
  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
  '&.Mui-focusVisible, &:active': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
  // The current page: a white bar under its link.
  '&[aria-current="page"]': { boxShadow: 'inset 0 -3px 0 #fff', borderRadius: '4px 4px 0 0' },
}

// Whether a link's page is the one shown: / only itself, the others their
// section too (/map/<cave>, /caves/<id>, /sistemas/<id>...).
const isCurrent = (to, pathname) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))

const StyledButton = styled(Button)({
  color: 'var(--mui-palette-primary-contrastText)',
  whiteSpace: 'nowrap',
  borderColor: 'rgba(255 255 255 / 0.5)',
  ':hover': {
    borderColor: '#fff',
  },
})

export default function AppBar(props) {
  const { window } = props
  const dispatch = useDispatch()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [entityHeadingHidden, setEntityHeadingHidden] = useState(false)
  // The edit page's own heading, e.g. "Cenote X" - not the document title,
  // which also says "Edit".
  const [entityHeadingText, setEntityHeadingText] = useState('')
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const theme = useTheme()
  const isSmall = useSmall(theme.breakpoints.down('md'))
  // Phones only: wider screens keep the edit page's own header in view
  // instead (EditPageHeader, sticky).
  const isPhone = useSmall()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const isNamedEditPage = isPhone && (/^\/(?:caves|sistemas|connections)\/[^/]+\/edit$/.test(location.pathname) || referenceDataItemPath.test(location.pathname))
  const toolbarTitle = isNamedEditPage && entityHeadingHidden && entityHeadingText ? entityHeadingText : APP_TITLE
  const canAccessDashboard = isLoggedIn && (roles.includes('editor') || roles.includes('admin'))
  // The site's pages, on the left; the dashboard (editors) on the right,
  // beside the account button. The phone drawer has the site's pages, then
  // the dashboard, then About last, each group set apart by a divider.
  const navItems = [
    { key: 'home', to: '/', icon: <HomeRounded /> },
    { key: 'map', to: '/map', icon: <MapRounded /> },
    { key: 'caves', to: '/caves', icon: <SvgIcon inheritViewBox><CaveIcon /></SvgIcon> },
    { key: 'sistemas', to: '/sistemas', icon: <SvgIcon component={CaveSystemIcon} inheritViewBox /> },
    { key: 'about', to: '/about', icon: <InfoRounded /> },
  ]
  const dashboardItem = { key: 'admin', to: '/dashboard', icon: <DashboardRounded /> }
  const aboutItem = navItems.find((item) => item.key === 'about')
  const drawerItems = [...navItems.filter((item) => item !== aboutItem), ...(canAccessDashboard ? [dashboardItem] : []), aboutItem]
  // The bar itself leaves Home out: the logo and the title link there, as
  // people expect - the phone drawer keeps it.
  const barItems = navItems.filter(({ key }) => key !== 'home')
  const current = (to) => (isCurrent(to, location.pathname) ? 'page' : undefined)

  useEffect(() => {
    setEntityHeadingHidden(false)
    if (!isNamedEditPage) return undefined

    const scrollRoot = document.querySelector('.oc-layout')
    if (!scrollRoot) return undefined

    let observedHeading = null
    const intersectionObserver = new IntersectionObserver(([entry]) => setEntityHeadingHidden(!entry.isIntersecting), { root: scrollRoot, rootMargin: '-64px 0px 0px 0px', threshold: 0 })
    const observeHeading = () => {
      const heading = scrollRoot.querySelector('[data-appbar-page-title]')
      // Also on every change to it: the name arrives once the item loads.
      setEntityHeadingText(heading?.textContent.trim() || '')
      if (heading && heading !== observedHeading) {
        if (observedHeading) intersectionObserver.unobserve(observedHeading)
        observedHeading = heading
        intersectionObserver.observe(heading)
      }
    }
    const mutationObserver = new MutationObserver(observeHeading)

    observeHeading()
    mutationObserver.observe(scrollRoot, { childList: true, subtree: true, characterData: true })

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

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2 }} noWrap>
        {APP_TITLE}
      </Typography>
      <Divider />
      <List>
        {drawerItems.map(({ key, to, icon }) => (
          <Fragment key={key}>
            {(key === dashboardItem.key || key === aboutItem.key) && <Divider component="li" role="none" sx={{ my: 1 }} />}
            <ListItem disablePadding>
              <ListItemButton component={Link} to={to} selected={Boolean(current(to))} aria-current={current(to)}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={t(`${key}`, { name: APP_NAME })} />
              </ListItemButton>
            </ListItem>
          </Fragment>
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
                {barItems.map(({ key, to, icon }) => (
                  <Button key={key} component={Link} to={to} startIcon={icon} aria-current={current(to)} sx={NAV_LINK_SX}>
                    {t(`${key}`, { name: APP_NAME })}
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
              {canAccessDashboard && !isSmall && (
                <Button className="oc-app-bar--dashboard" component={Link} to="/dashboard" startIcon={dashboardItem.icon} aria-current={current('/dashboard')} sx={{ ...NAV_LINK_SX, mr: 1 }}>
                  {t('admin', { name: APP_NAME })}
                </Button>
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
