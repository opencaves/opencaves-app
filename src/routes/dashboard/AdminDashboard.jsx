import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useTitle } from '@/hooks/useTitle.jsx'

const REFERENCE_COLLECTIONS = [
  { collection: 'accesses', label: 'Accesses' },
  { collection: 'accessibilities', label: 'Accessibilities' },
  { collection: 'sources', label: 'Sources' },
  { collection: 'areas', label: 'Areas' },
  { collection: 'colors', label: 'Colors' },
  { collection: 'languages', label: 'Languages' },
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
              <ListItemText primary="Manage caves" />
            </ListItemButton>
            <ListItemButton component={Link} to="/sistemas" divider>
              <ListItemText primary="Manage sistemas" />
            </ListItemButton>
          </List>

          <Typography component="h2" variant="h6" sx={{ mt: 3, mb: 1 }}>
            Reference data
          </Typography>
          <List disablePadding>
            {REFERENCE_COLLECTIONS.map(({ collection, label }) => (
              <ListItemButton key={collection} component={Link} to={`/${collection}`} divider>
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
              <ListItemText primary={t('manageUsers')} />
            </ListItemButton>
          </List>
        </>
      )}

      {!isEditor && !isAdmin && (
        <Typography color="text.secondary">{t('noSections')}</Typography>
      )}
    </div>
  )
}
