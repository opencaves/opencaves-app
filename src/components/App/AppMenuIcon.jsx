import { useSelector } from 'react-redux'
import { Avatar } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined'

export default function AppMenuIcon({ logoColorScheme, logoSx, avatarSx }) {
  const user = useSelector(state => state.session.user)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const theme = useTheme()

  // Signed out: the account placeholder, not the logo - the logo leads home
  // (the app bar's, the map search bar's), so it can't also open this menu.
  // logoColorScheme: the background it sits on ("dark": the app bar).
  if (!isLoggedIn) {
    return <AccountCircleOutlined className="oc-app-menu-icon" sx={{ width: logoSx?.width || 28, height: logoSx?.height || 28, color: logoColorScheme === 'dark' ? 'common.white' : 'action.active' }} />
  }

  const initial = user.displayName?.trim()?.[0]?.toUpperCase()

  return (
    <Avatar
      className="oc-app-menu-icon"
      src={user.photoURL || undefined}
      alt={user.displayName}
      sx={{
        bgcolor: theme.palette.primary.main,
        width: '32px',
        height: '32px',
        ...avatarSx,
      }}
    >
      {!user.photoURL && initial}
    </Avatar>
  )
}
