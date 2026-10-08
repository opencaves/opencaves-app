import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Chip, List, ListItem, ListItemButton, ListItemIcon, ListItemText, SvgIcon, Typography } from '@mui/material'
import AccessibleRounded from '@mui/icons-material/AccessibleRounded'
import LanguageRounded from '@mui/icons-material/LanguageRounded'
import LinkRounded from '@mui/icons-material/LinkRounded'
import LockOpenRounded from '@mui/icons-material/LockOpenRounded'
import PaletteRounded from '@mui/icons-material/PaletteRounded'
import PeopleRounded from '@mui/icons-material/PeopleRounded'
import LayersRounded from '@mui/icons-material/LayersRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import FeedbackRounded from '@mui/icons-material/FeedbackRounded'
import PublicRounded from '@mui/icons-material/PublicRounded'
import SourceRounded from '@mui/icons-material/SourceRounded'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useMapsToProcess } from '@/routes/map-layers/useMapsToProcess.js'
import { useNewFeedbackCount } from '@/routes/feedback/useNewFeedbackCount.js'
import CaveIcon from '@/images/map/cave.svg?react'
import CaveSystemIcon from '@/images/cave-system.svg?react'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'
import LegalLinks from '@/components/App/LegalLinks.jsx'


const REFERENCE_COLLECTIONS = [
  { collection: 'accesses', icon: LockOpenRounded },
  { collection: 'accessibilities', icon: AccessibleRounded },
  { collection: 'sources', icon: SourceRounded },
  { collection: 'areas', icon: PublicRounded },
  { collection: 'colors', icon: PaletteRounded },
  { collection: 'languages', icon: LanguageRounded },
]

const DASHBOARD_SURFACE = 'var(--oc-page-surface-translucent)'
const dashboardItemSx = (theme) => ({
  position: 'relative',
  bgcolor: theme.vars.palette.action.hover,
  transition: 'background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
  '&:hover': {
    bgcolor: theme.vars.palette.action.selected,
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
  // The testers' reports still to read.
  const newFeedback = useNewFeedbackCount(isAdmin)
  const mapsToProcess = useMapsToProcess().toProcess.length

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <Box
      className="oc-admin-dashboard"
      // A window onto Layout's background image (behind the whole page) rather
      // than a second copy of it: Layout leaves its page transparent here, so
      // this box paints the page's surface itself - out over the page's padding
      // (negative margins), then its own 0.5rem/1rem frame - and is
      // see-through inside.
      sx={{
        mx: { xs: -2, sm: -3 },
        my: -2,
        minHeight: 'calc(100vh - 100px + 32px)',
        p: { xs: 1, sm: 2 },
        borderStyle: 'solid',
        borderColor: 'var(--oc-page-surface)',
        borderTopWidth: { xs: 'calc(16px + 0.5rem)', sm: 'calc(16px + 1rem)' },
        borderBottomWidth: { xs: 'calc(16px + 0.5rem)', sm: 'calc(16px + 1rem)' },
        borderLeftWidth: { xs: 'calc(16px + 0.5rem)', sm: 'calc(24px + 1rem)' },
        borderRightWidth: { xs: 'calc(16px + 0.5rem)', sm: 'calc(24px + 1rem)' },
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
                    <ListItemButton component={Link} to="/caves/edit" divider sx={dashboardItemSx}>
                      <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                        {/* The cave drawn inside the map pins */}
                        <SvgIcon inheritViewBox>
                          <CaveIcon />
                        </SvgIcon>
                      </ListItemIcon>
                      <ListItemText primary={t('manageCaves')} />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/sistemas/edit" divider sx={dashboardItemSx}>
                      <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                        {/* The cave details pane's sistema icon */}
                        <SvgIcon component={CaveSystemIcon} inheritViewBox />
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
                  {/* Colours and languages: admins only (adminOnly). */}
                  {REFERENCE_COLLECTIONS.filter(({ collection }) => isAdmin || !REFERENCE_DATA_CONFIGS[collection]?.adminOnly).map(({ collection, icon: Icon }) => (
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
                {t('adminSection')}
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
                <ListItem disablePadding>
                  <ListItemButton component={Link} to={mapsToProcess > 0 ? '/map-layers?tab=toProcess' : '/map-layers'} divider sx={dashboardItemSx}>
                    <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                      <LayersRounded />
                    </ListItemIcon>
                    <ListItemText primary={t('manageMapLayers')} />
                    {/* Maps added in the app waiting to be turned into the layer. */}
                    {mapsToProcess > 0 && <Chip className="oc-admin-dashboard--to-process" size="small" color="primary" label={t('mapsToProcess', { count: mapsToProcess })} />}
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/feedback" divider sx={dashboardItemSx}>
                    <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                      <FeedbackRounded />
                    </ListItemIcon>
                    <ListItemText primary={t('manageFeedback')} />
                    {newFeedback > 0 && <Chip className="oc-admin-dashboard--new-feedback" size="small" color="primary" label={t('newFeedback', { count: newFeedback })} />}
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/audits" divider sx={dashboardItemSx}>
                    <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>
                      <HistoryRounded />
                    </ListItemIcon>
                    <ListItemText primary={t('manageAudits')} />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          )}
        </Box>

        {!isEditor && !isAdmin && <Typography color="text.secondary">{t('noSections')}</Typography>}
        <LegalLinks sx={{ mt: 6, pt: 2, borderTop: '1px solid', borderColor: 'divider' }} />
      </Box>
    </Box>
  )
}
