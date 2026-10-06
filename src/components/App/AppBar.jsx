import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AppBar as MUIAppBar, IconButton, Toolbar, Typography, Button, styled, useTheme } from '@mui/material'
import { Grid } from '@mui/material'
import MenuRounded from '@mui/icons-material/MenuRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import LogoIcon from './LogoIcon.jsx'
import AppMenu from './AppMenu.jsx'
import NavDrawer, { useNavItems } from './NavDrawer.jsx'
import { APP_NAME, APP_TITLE } from '@/config/app.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

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

const StyledButton = styled(Button)({
  color: 'var(--mui-palette-primary-contrastText)',
  whiteSpace: 'nowrap',
  borderColor: 'rgba(255 255 255 / 0.5)',
  ':hover': {
    borderColor: '#fff',
  },
})

export default function AppBar() {
  const dispatch = useDispatch()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
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
      {isSmall && <NavDrawer open={mobileOpen} onClose={handleDrawerToggle} />}
      <Toolbar />
    </>
  )
}
