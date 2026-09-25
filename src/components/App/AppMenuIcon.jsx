import { useSelector } from 'react-redux'
import { Avatar } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import LogoIcon from './LogoIcon.jsx'

export default function AppMenuIcon({ logoColorScheme, logoSx, avatarSx }) {
  const user = useSelector(state => state.session.user)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const theme = useTheme()

  if (!isLoggedIn) {
    return <LogoIcon className="oc-app-menu-icon" colorScheme={logoColorScheme} sx={logoSx} />
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
