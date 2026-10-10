import { useSelector } from 'react-redux'
import { Avatar } from '@mui/material'
import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded'

export default function AppMenuIcon({ logoColorScheme, logoSx, avatarSx }) {
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)

  // Signed out: the account placeholder, not the logo - the logo leads home
  // (the app bar's, the map search bar's), so it can't also open this menu.
  // logoColorScheme: the background it sits on ("dark": the app bar).
  if (!isLoggedIn) {
    return <AccountCircleRounded className="oc-app-menu-icon" sx={{ width: logoSx?.width || 28, height: logoSx?.height || 28, color: logoColorScheme === 'dark' ? 'common.white' : 'action.active' }} />
  }

  const initial = user.displayName?.trim()?.[0]?.toUpperCase()

  return (
    <Avatar
      className="oc-app-menu-icon"
      src={user.photoURL || undefined}
      alt={user.displayName}
      sx={{
        // The initial pale on the primary colour in both modes (an Avatar's
        // own letter colour is the page's background: near-black in dark mode).
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        width: '32px',
        height: '32px',
        ...avatarSx,
      }}
    >
      {!user.photoURL && initial}
    </Avatar>
  )
}
