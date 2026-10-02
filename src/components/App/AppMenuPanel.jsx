import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signOut } from 'firebase/auth'
import { Avatar, Box, Button, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { AccountCircleOutlined, CloseRounded, InfoOutlined, LogoutRounded, SettingsRounded } from '@mui/icons-material'
import { auth } from '@/config/firebase.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import Message from '@/components/Message.jsx'
import OfflinePreviewsToggle from './menu/OfflinePreviewsToggle.jsx'
import { APP_NAME } from '@/config/app.js'
import { offlineSupported } from '@/services/offline/offlineMedia.js'

// The account menu's content, in the style of Google Maps' account card: a
// header (avatar, greeting and "Manage your account" when signed in; a
// welcome with Log in / Sign up when not), the other actions grouped on white
// rounded sections over the card's tinted surface, and the legal links at the
// bottom. Rendered in AppMenu's Popover.
export default function AppMenuPanel({ onClose, titleId }) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const { t: tLegal } = useTranslation('legal', { keyPrefix: 'links' })
  const dispatch = useDispatch()
  const location = useLocation()
  const [openSnackbar] = useSnackbar()
  const user = useSelector((state) => state.session.user)
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const canUseDashboard = isLoggedIn && roles.includes('editor')

  const displayName = user?.displayName?.trim()
  const initial = displayName?.[0]?.toUpperCase()

  // Coming back to where you were after logging in or signing up (not when
  // already on those pages).
  function rememberWhereIWas() {
    if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/signup')) {
      dispatch(setContinueUrl(buildContinueUrl(location)))
    }
    onClose()
  }

  async function logOut() {
    onClose()
    try {
      await signOut(auth)
      openSnackbar(<Message message={t('logoutSuccess')} />)
    } catch (error) {
      console.error(error)
    }
  }

  const sectionSx = { bgcolor: 'background.paper', borderRadius: 4, overflow: 'hidden', py: 0.5 }
  const rowSx = { minHeight: 48, px: 2.5 }

  return (
    <Box className="oc-app-menu-panel" sx={{ width: 'min(360px, calc(100vw - 16px))', p: 1, pb: 1.5 }}>
      <Box sx={{ position: 'relative', textAlign: 'center', px: 2, pt: 1.5, pb: 2 }}>
        <IconButton aria-label={t('close')} onClick={onClose} sx={{ position: 'absolute', top: 4, right: 4 }}>
          <CloseRounded />
        </IconButton>

        {isLoggedIn ? (
          <>
            {user?.email && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ px: 5, mb: 2 }}>
                {user.email}
              </Typography>
            )}
            <Avatar src={user?.photoURL || undefined} alt="" sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5, bgcolor: 'primary.main', fontSize: 32 }}>
              {!user?.photoURL && initial}
            </Avatar>
            <Typography id={titleId} component="h2" sx={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, mb: 2 }}>
              {displayName ? t('greeting', { name: displayName }) : t('greetingNoName')}
            </Typography>
            <Button variant="outlined" component={Link} to="/account" onClick={onClose} sx={{ borderRadius: 5, px: 3, textTransform: 'none', bgcolor: 'background.paper' }}>
              {t('manageAccount')}
            </Button>
          </>
        ) : (
          <>
            <AccountCircleOutlined sx={{ fontSize: 72, color: 'text.secondary', mt: 3, mb: 1 }} />
            <Typography id={titleId} component="h2" sx={{ fontSize: 22, lineHeight: '28px', fontWeight: 400, mb: 1 }}>
              {t('welcome', { name: APP_NAME })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 2 }}>
              {t('welcomeText')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Button variant="contained" disableElevation component={Link} to="/login" onClick={rememberWhereIWas} sx={{ borderRadius: 5, px: 3, textTransform: 'none' }}>
                {t('login')}
              </Button>
              <Button variant="outlined" component={Link} to="/signup" onClick={rememberWhereIWas} sx={{ borderRadius: 5, px: 3, textTransform: 'none', bgcolor: 'background.paper' }}>
                {t('signup')}
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* Groups on white sections, in place of dividers. component="div":
          the rows are buttons/links, not <li>s. */}
      {isLoggedIn && (
        <List component="div" disablePadding sx={{ ...sectionSx, mb: 0.5 }}>
          <ListItemButton onClick={logOut} sx={rowSx}>
            <ListItemIcon>
              <LogoutRounded />
            </ListItemIcon>
            <ListItemText primary={t('logout')} />
          </ListItemButton>
        </List>
      )}

      {/* The dashboard and the offline toggle share a section, a divider
          between them when both are shown. */}
      {(canUseDashboard || offlineSupported) && (
        <List component="div" disablePadding sx={{ ...sectionSx, mb: 0.5 }}>
          {canUseDashboard && (
            <ListItemButton component={Link} to="/dashboard" onClick={onClose} sx={rowSx}>
              <ListItemIcon>
                <SettingsRounded />
              </ListItemIcon>
              <ListItemText primary={t('admin')} />
            </ListItemButton>
          )}
          {canUseDashboard && offlineSupported && <Divider component="div" role="presentation" />}
          {offlineSupported && <OfflinePreviewsToggle sx={rowSx} />}
        </List>
      )}

      <List component="div" disablePadding sx={sectionSx}>
        <ListItemButton component={Link} to="/about" state={{ backgroundLocation: location }} onClick={onClose} sx={rowSx}>
          <ListItemIcon>
            <InfoOutlined />
          </ListItemIcon>
          <ListItemText primary={t('about', { context: 'withName', name: APP_NAME })} />
        </ListItemButton>
      </List>

      <Box component="nav" aria-label={tLegal('ariaLabel')} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1.5, typography: 'caption', color: 'text.secondary' }}>
        <Box component={Link} to="/privacy" onClick={onClose} sx={{ color: 'inherit', textDecoration: 'none', px: 0.5, minHeight: 24, display: 'inline-flex', alignItems: 'center', '&:hover, &:focus-visible': { textDecoration: 'underline' } }}>
          {tLegal('privacy')}
        </Box>
        <Box component="span" aria-hidden="true">
          ·
        </Box>
        <Box component={Link} to="/terms" onClick={onClose} sx={{ color: 'inherit', textDecoration: 'none', px: 0.5, minHeight: 24, display: 'inline-flex', alignItems: 'center', '&:hover, &:focus-visible': { textDecoration: 'underline' } }}>
          {tLegal('terms')}
        </Box>
      </Box>
    </Box>
  )
}
