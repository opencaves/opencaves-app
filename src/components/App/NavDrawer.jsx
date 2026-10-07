import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, SvgIcon, Typography } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import CloseRounded from '@mui/icons-material/CloseRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import InfoRounded from '@mui/icons-material/InfoRounded'
import NewReleasesOutlined from '@mui/icons-material/NewReleasesOutlined'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import CaveIcon from '@/images/map/cave.svg?react'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import { APP_NAME, APP_TITLE } from '@/config/app.js'
import LogoIcon from './LogoIcon.jsx'

const DRAWER_WIDTH = 240

// Whether a link's page is the one shown: / only itself, the others their
// section too (/map/<cave>, /caves/<id>, /sistemas/<id>...).
export const isCurrent = (to, pathname) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))

// The site's pages, and the dashboard for editors: the app bar's links and
// the phone drawer's. current(to): 'page' for the page shown (aria-current).
export function useNavItems() {
  const location = useLocation()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const canAccessDashboard = isLoggedIn && (roles.includes('editor') || roles.includes('admin'))
  const navItems = [
    { key: 'home', to: '/', icon: <HomeRounded /> },
    { key: 'map', to: '/map', icon: <MapRounded /> },
    { key: 'caves', to: '/caves', icon: <SvgIcon inheritViewBox><CaveIcon /></SvgIcon> },
    { key: 'sistemas', to: '/sistemas', icon: <SvgIcon component={CaveSystemIcon} inheritViewBox /> },
    { key: 'whatsNew', to: '/whats-new', icon: <NewReleasesOutlined /> },
    { key: 'about', to: '/about', icon: <InfoRounded /> },
  ]
  const dashboardItem = { key: 'admin', to: '/dashboard', icon: <DashboardRounded /> }
  const current = (to) => (isCurrent(to, location.pathname) ? 'page' : undefined)
  return { navItems, dashboardItem, canAccessDashboard, current }
}

// The phone's navigation drawer, opened from the app bar's menu button or the
// map search bar's: its header (the logo and title, a link home, and a close
// button), the site's pages, then the dashboard (editors), then About last,
// each group set apart by a divider. No Home item: the header links there.
// zIndex: over the map page's Ionic sheet (its own, much higher, stacking).
export default function NavDrawer({ open, onClose, zIndex }) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const { navItems, dashboardItem, canAccessDashboard, current } = useNavItems()
  const aboutItem = navItems.find((item) => item.key === 'about')
  const items = [...navItems.filter((item) => item !== aboutItem && item.key !== 'home'), ...(canAccessDashboard ? [dashboardItem] : []), aboutItem]
  // The logo drawn for the drawer's own surface, light or dark.
  const { mode, systemMode } = useColorScheme()
  const scheme = (mode === 'system' ? systemMode : mode) || 'light'

  return (
    <nav aria-label={t('navDrawer')}>
      <Drawer
        className="oc-nav-drawer"
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ ...(zIndex && { zIndex }), '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH } }}
      >
        <Box onClick={onClose}>
          <Box className="oc-nav-drawer--header" sx={{ display: 'flex', alignItems: 'center', minHeight: 64, pl: 2, pr: 0.5 }}>
            <Box component={Link} to="/" aria-current={current('/')} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1, color: 'text.primary', textDecoration: 'none' }}>
              <LogoIcon colorScheme={scheme} />
              <Typography variant="h6" noWrap sx={{ color: 'text.primary' }}>
                {APP_TITLE}
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label={t('close')} sx={{ p: 1.5 }}>
              <CloseRounded />
            </IconButton>
          </Box>
          <Divider />
          <List>
            {items.map(({ key, to, icon }) => (
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
      </Drawer>
    </nav>
  )
}
