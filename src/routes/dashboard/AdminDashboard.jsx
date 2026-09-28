import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { AccessibleRounded, AccountTreeRounded, LanguageRounded, LinkRounded, LockOpenRounded, MapRounded, PaletteRounded, PeopleRounded, PublicRounded, SourceRounded } from '@mui/icons-material'
import { useTitle } from '@/hooks/useTitle.jsx'
import dashboardBackground from '@/images/dashboard/bg.webp'

const REFERENCE_COLLECTIONS = [
  { collection: 'accesses', icon: LockOpenRounded },
  { collection: 'accessibilities', icon: AccessibleRounded },
  { collection: 'sources', icon: SourceRounded },
  { collection: 'areas', icon: PublicRounded },
  { collection: 'colors', icon: PaletteRounded },
  { collection: 'languages', icon: LanguageRounded },
]

const DASHBOARD_SURFACE = 'rgba(255, 255, 255, 0.9)'
const dashboardItemSx = (theme) => ({
  position: 'relative',
  bgcolor: 'rgba(0, 0, 0, 0.03)',
  transition: 'background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
  '&:hover': {
    bgcolor: 'rgba(0, 0, 0, 0.08)',
    boxShadow: theme.shadows[1],
    transform: 'translateY(-1px)',
    zIndex: 1,
  },
})

export default function AdminDashboard() {
  const { t } = useTranslation('dashboard')
  const { setTitle } = useTitle()
  const roles = useSelector((state) => state.session.roles)
  const isEditor = roles.includes('editor')
  const isAdmin = roles.includes('admin')

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box
      className="oc-admin-dashboard"
      sx={{
        width: '100%',
        minHeight: 'calc(100vh - 100px)',
        p: { xs: 1, sm: 2 },
        border: { xs: '0.5rem solid #fff', sm: '1rem solid #fff' },
        borderRadius: '4px',
        backgroundColor: '#000',
        backgroundImage: `url(${dashboardBackground})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <Box sx={{ width: '100%', height: '100%', maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 4 }, pb: 4, bgcolor: DASHBOARD_SURFACE }}>
        <Box sx={{ mb: 4, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 500 }}>
            {t('title')}
          </Typography>
          <Box sx={{ width: 56, height: 4, mt: 1.5, borderRadius: 2, bgcolor: 'secondary.main' }} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3, alignItems: 'start' }}>
          {isEditor && (
            <>
              <Box component="section">
                <Typography component="h2" variant="overline" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
                  {t('cavesSection')}
                </Typography>
                <List disablePadding sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: DASHBOARD_SURFACE }}>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/caves" divider sx={dashboardItemSx}>
                      <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                        <MapRounded />
                      </ListItemIcon>
                      <ListItemText primary={t('manageCaves')} />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/sistemas" divider sx={dashboardItemSx}>
                      <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                        <AccountTreeRounded />
                      </ListItemIcon>
                      <ListItemText primary={t('manageSistemas')} />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/connections" divider sx={dashboardItemSx}>
                      <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                        <LinkRounded />
                      </ListItemIcon>
                      <ListItemText primary={t('manageSistemaConnections')} />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Box>

              <Box component="section">
                <Typography component="h2" variant="overline" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
                  {t('referenceDataSection')}
                </Typography>
                <List disablePadding sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: DASHBOARD_SURFACE }}>
                  {REFERENCE_COLLECTIONS.map(({ collection, icon: Icon }) => (
                    <ListItem key={collection} disablePadding>
                      <ListItemButton component={Link} to={`/${collection}`} divider sx={dashboardItemSx}>
                        <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                          <Icon />
                        </ListItemIcon>
                        <ListItemText primary={t(`collections.${collection}.title`)} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}

          {isAdmin && (
            <Box component="section">
              <Typography component="h2" variant="overline" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}>
                {t('usersSection')}
              </Typography>
              <List disablePadding sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: DASHBOARD_SURFACE }}>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/users" divider sx={dashboardItemSx}>
                    <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                      <PeopleRounded />
                    </ListItemIcon>
                    <ListItemText primary={t('manageUsers')} />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          )}
        </Box>

        {!isEditor && !isAdmin && <Typography color="text.secondary">{t('noSections')}</Typography>}
      </Box>
    </Box>
  )
}
