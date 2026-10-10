import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AppBar as MUIAppBar, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Tooltip, Typography, Button, useTheme } from '@mui/material'
import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded'
import LoginRounded from '@mui/icons-material/LoginRounded'
import PersonAddAlt1Rounded from '@mui/icons-material/PersonAddAlt1Rounded'
import { Grid } from '@mui/material'
import MenuRounded from '@mui/icons-material/MenuRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import LogoIcon from './LogoIcon.jsx'
import AppMenu from './AppMenu.jsx'
import NavDrawer, { useNavItems } from './NavDrawer.jsx'
import AppBarSearch from './AppBarSearch.jsx'
import { APP_NAME, APP_TITLE } from '@/config/app.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

// The bar's links, as MD3's navigation items: 40dp pills, a 24dp icon 8dp
// from the label (label large), in the bar's muted text color; the state
// layers in its text color (hover 8%, focus and pressed 10%); the current
// page on its own pill. The colors: the bar's (--oc-app-bar-*,
// variables.scss).
const NAV_LINK_SX = (theme) => ({
  height: 40,
  px: 2,
  borderRadius: 5,
  color: 'var(--oc-app-bar-fg-variant)',
  ...theme.typography.button,
  textTransform: 'none',
  letterSpacing: '0.00625rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { mr: 1, ml: 0, '& > *:nth-of-type(1)': { fontSize: 24 } },
  '&:hover': { bgcolor: 'rgb(var(--oc-app-bar-state) / 0.08)' },
  '&.Mui-focusVisible, &:active': { bgcolor: 'rgb(var(--oc-app-bar-state) / 0.1)' },
  '&[aria-current="page"]': { bgcolor: 'var(--oc-app-bar-active-bg)', color: 'var(--oc-app-bar-active-fg)' },
  // Below 1536px, labels only: the links, the search field and the title fit
  // side by side.
  [theme.breakpoints.down('xl')]: { px: 1.5, '& .MuiButton-startIcon': { display: 'none' } },
  // Below 1200px, closer together.
  [theme.breakpoints.down('lg')]: { px: 1 },
})

// The Map link's icon in the secondary colour (the app's gold), set apart
// from the other links: the map is the app's heart. Its own colour in every
// state, the active one included.
const MAP_ICON_SX = (theme) => ({ '& .MuiButton-startIcon': { color: theme.vars.palette.secondary.main } })

// Material Design 3's small top app bar: 64dp tall on phones too (MUI's is
// 56px there, 48px sideways - '&&' outweighs its media queries), 4dp at its
// ends on phones, where its icon buttons are 48dp touch targets. No shadow;
// its colors the bar's (--oc-app-bar-*, variables.scss): the brand teal in
// the light theme, MD3's surface bar in the dark one, which takes the surface
// container color once the page scrolls under it (M3's on-scroll state).
const APP_BAR_TOOLBAR_SX = { '&&': { minHeight: 64 }, px: { xs: 0.5, sm: 3 } }


export default function AppBar() {
  const dispatch = useDispatch()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signInMenuAnchor, setSignInMenuAnchor] = useState(null)
  const [entityHeadingHidden, setEntityHeadingHidden] = useState(false)
  // The page's own heading (its data-appbar-page-title), e.g. "Cenote X" -
  // not the document title, which also says "Edit" or the site's name.
  const [entityHeadingText, setEntityHeadingText] = useState('')
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const theme = useTheme()
  const isSmall = useSmall(theme.breakpoints.down('md'))
  // Phones only: once the page's heading scrolls under the bar, the bar shows
  // it. Wider screens keep an edit page's own header in view instead
  // (EditPageHeader, sticky).
  const isPhone = useSmall()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  // The page scrolled under the bar (its scroll area, Layout's).
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const scrollRoot = document.querySelector('.oc-layout')
    if (!scrollRoot) return undefined
    const update = () => setScrolled(scrollRoot.scrollTop > 0)
    update()
    scrollRoot.addEventListener('scroll', update, { passive: true })
    return () => scrollRoot.removeEventListener('scroll', update)
  }, [location.pathname])
  const toolbarTitle = isPhone && entityHeadingHidden && entityHeadingText ? entityHeadingText : APP_TITLE
  // The site's pages, on the left; the dashboard (editors) on the right,
  // beside the account button (NavDrawer's order on phones).
  const { navItems, dashboardItem, canAccessDashboard, current } = useNavItems()
  // The bar itself leaves Home out: the logo and the title link there, as
  // people expect - the phone drawer keeps it.
  const barItems = navItems.filter(({ key }) => key !== 'home')

  useEffect(() => {
    setEntityHeadingHidden(false)
    setEntityHeadingText('')
    if (!isPhone) return undefined

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
  }, [isPhone, location.pathname])

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState)
  }

  function captureContinueUrl() {
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/signup')) {
      return
    }

    dispatch(setContinueUrl(buildContinueUrl(location)))
  }


  return (
    <>
      <MUIAppBar
        className="oc-app-bar"
        component="nav"
        aria-label={t('navMain')}
        color="inherit"
        elevation={0}
        sx={(theme) => ({
          bgcolor: scrolled ? 'var(--oc-app-bar-bg-scrolled)' : 'var(--oc-app-bar-bg)',
          color: 'var(--oc-app-bar-fg)',
          backgroundImage: 'none',
          transition: theme.transitions.create('background-color', { duration: 200 }),
        })}
      >
        <Toolbar sx={APP_BAR_TOOLBAR_SX}>
          {isSmall && (
            <IconButton color="inherit" aria-label={t('drawer.ariaLabel')} onClick={handleDrawerToggle} sx={{ p: 1.5, mr: { xs: 0.5, sm: 2 } }}>
              <MenuRounded />
            </IconButton>
          )}

          {/* Same destination as the title link beside it: hidden from
              assistive tech and the tab order instead of a second,
              text-less link. */}
          <Link to="/" aria-hidden="true" tabIndex={-1} style={{ flexShrink: 0, display: "flex" }}>
            {/* The logo for a dark background: the light theme's teal bar, as
                the dark theme's near black one. */}
            <LogoIcon colorScheme="dark" sx={{ mr: 1, flexShrink: 0 }} />
          </Link>

          {/* Shrinks before the bar's buttons do, its title cut with an
              ellipsis (a long page title, shown here once scrolled). */}
          <Button
            variant="text"
            component={Link}
            to="/"
            color="inherit"
            sx={{
              mr: { xs: 1, sm: 3 },
              p: 0,
              minWidth: 0,
              flexShrink: 1,
              justifyContent: 'flex-start',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <Typography
              key={toolbarTitle}
              component="span"
              noWrap
              sx={{
                // MD3's title large.
                fontSize: '1.375rem',
                lineHeight: '1.75rem',
                fontWeight: 400,
                letterSpacing: 0,
                textTransform: 'none',
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
          </Button>

          {/* Centred on the bar's height, links and buttons alike (the links
              sat 4 px higher than the buttons on the right). */}
          <Grid container sx={{ flexWrap: 'nowrap', flex: '1 1 auto', minWidth: 'fit-content', alignItems: 'center' }}>
            {!isSmall && (
              <Grid sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {barItems.map(({ key, to, icon, onClick }) => (
                  <Button key={key} component={Link} to={to} onClick={onClick} startIcon={icon} aria-current={current(to)} sx={key === 'map' ? [NAV_LINK_SX, MAP_ICON_SX] : NAV_LINK_SX}>
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
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppBarSearch />
              {!isLoggedIn && isSmall && (
                // Phones and small tablets (the drawer's layout): one account
                // button opening Log in and Sign up, beside the search.
                <>
                  <Tooltip title={t('signInMenu')}>
                    <IconButton color="inherit" aria-label={t('signInMenu')} aria-haspopup="menu" aria-expanded={signInMenuAnchor ? 'true' : undefined} aria-controls={signInMenuAnchor ? 'oc-app-bar-sign-in-menu' : undefined} onClick={(event) => setSignInMenuAnchor(event.currentTarget)} sx={{ p: 1.5 }}>
                      <AccountCircleRounded />
                    </IconButton>
                  </Tooltip>
                  <Menu id="oc-app-bar-sign-in-menu" className="oc-app-bar--sign-in-menu" anchorEl={signInMenuAnchor} open={Boolean(signInMenuAnchor)} onClose={() => setSignInMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                    <MenuItem component={Link} to="/login" onClick={() => { captureContinueUrl(); setSignInMenuAnchor(null) }}>
                      <ListItemIcon><LoginRounded fontSize="small" /></ListItemIcon>
                      {t('login')}
                    </MenuItem>
                    <MenuItem component={Link} to="/signup" onClick={() => { captureContinueUrl(); setSignInMenuAnchor(null) }}>
                      <ListItemIcon><PersonAddAlt1Rounded fontSize="small" /></ListItemIcon>
                      {t('signup')}
                    </MenuItem>
                  </Menu>
                </>
              )}
              {!isLoggedIn && !isSmall && (
                <>
                  {/* MD3's 40dp buttons; the last 12px from the bar's end. */}
                  {/* MD3's text and outlined buttons, in the bar's action color. */}
                  <Button variant="text" component={Link} to="/login" onClick={captureContinueUrl} sx={{ height: 40, whiteSpace: 'nowrap', color: 'var(--oc-app-bar-action)' }}>
                    {t('login')}
                  </Button>
                  <Button variant="outlined" component={Link} to="/signup" onClick={captureContinueUrl} sx={{ height: 40, whiteSpace: 'nowrap', ml: 1, mr: { xs: 1, sm: 0 }, color: 'var(--oc-app-bar-action)', borderColor: 'var(--oc-app-bar-outline)' }}>
                    {t('signup')}
                  </Button>
                </>
              )}
              {canAccessDashboard && !isSmall && (
                <Button className="oc-app-bar--dashboard" component={Link} to="/dashboard" startIcon={dashboardItem.icon} aria-current={current('/dashboard')} sx={[NAV_LINK_SX, { mr: 1 }]}>
                  {t('admin', { name: APP_NAME })}
                </Button>
              )}
              {isLoggedIn && (
                // A 32px avatar; on phones in a 48dp touch target (MD3).
                <AppMenu
                  logoColorScheme="dark"
                  disableElevation
                  avatarSx={{ width: 32, height: 32 }}
                  sx={(theme) => ({
                    ml: 1,
                    width: { xs: 48, sm: theme.spacing(5) },
                    height: { xs: 48, sm: theme.spacing(5) },
                    minWidth: { xs: 48, sm: theme.spacing(5) },
                    p: 0,
                    borderRadius: '50%',
                  })}
                />
              )}
            </Grid>
          </Grid>
        </Toolbar>
      </MUIAppBar>
      {isSmall && <NavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />}
      {/* The bar's room at the top of the page. */}
      <Toolbar sx={APP_BAR_TOOLBAR_SX} />
    </>
  )
}
