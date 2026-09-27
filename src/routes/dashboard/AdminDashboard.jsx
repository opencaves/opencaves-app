import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { AccessibleRounded, AccountTreeRounded, LanguageRounded, LinkRounded, LockOpenRounded, MapRounded, PaletteRounded, PeopleRounded, PublicRounded, SourceRounded } from '@mui/icons-material'
import { useTitle } from '@/hooks/useTitle.jsx'

const REFERENCE_COLLECTIONS = [
  { collection: 'accesses', label: 'Accesses', icon: LockOpenRounded },
  { collection: 'accessibilities', label: 'Accessibilities', icon: AccessibleRounded },
  { collection: 'sources', label: 'Sources', icon: SourceRounded },
  { collection: 'areas', label: 'Areas', icon: PublicRounded },
  { collection: 'colors', label: 'Colors', icon: PaletteRounded },
  { collection: 'languages', label: 'Languages', icon: LanguageRounded },
]

export default function AdminDashboard() {
  const { t } = useTranslation('dashboard')
  const { setTitle } = useTitle()
  const roles = useSelector((state) => state.session.roles)
  const isEditor = roles.includes('editor')
  const isAdmin = roles.includes('admin')

  useEffect(() => {
    setTitle('Dashboard')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="oc-admin-dashboard">
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      {isEditor && (
        <>
          <Typography component="h2" variant="h6" sx={{ mt: 2, mb: 1 }}>
            Caves
          </Typography>
          <List disablePadding>
            <ListItemButton component={Link} to="/caves" divider>
              <ListItemIcon>
                <MapRounded />
              </ListItemIcon>
              <ListItemText primary="Manage caves" />
            </ListItemButton>
            <ListItemButton component={Link} to="/sistemas" divider>
              <ListItemIcon>
                <AccountTreeRounded />
              </ListItemIcon>
              <ListItemText primary="Manage sistemas" />
            </ListItemButton>
            <ListItemButton component={Link} to="/connections" divider>
              <ListItemIcon>
                <LinkRounded />
              </ListItemIcon>
              <ListItemText primary={t('manageSistemaConnections')} />
            </ListItemButton>
          </List>

          <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>
            Reference data
          </Typography>
          <List disablePadding>
            {REFERENCE_COLLECTIONS.map(({ collection, label, icon: Icon }) => (
              <ListItemButton key={collection} component={Link} to={`/${collection}`} divider>
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}

      {isAdmin && (
        <>
          <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>
            {t('usersSection')}
          </Typography>
          <List disablePadding>
            <ListItemButton component={Link} to="/users" divider>
              <ListItemIcon>
                <PeopleRounded />
              </ListItemIcon>
              <ListItemText primary={t('manageUsers')} />
            </ListItemButton>
          </List>
        </>
      )}

      {!isEditor && !isAdmin && <Typography color="text.secondary">{t('noSections')}</Typography>}
    </div>
  )
}
