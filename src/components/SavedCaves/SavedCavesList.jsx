import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import Bookmark from '@mui/icons-material/BookmarkRounded'
import BookmarkRemoveRounded from '@mui/icons-material/BookmarkRemoveRounded'
import CloudDoneRounded from '@mui/icons-material/CloudDoneRounded'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { getData } from '@/services/data-service.jsx'
import { useOfflineStatus, useSavedCavesOfflineSummary } from '@/hooks/useOfflineStatus.jsx'
import { offlineSupported, savedCaveStatusKey } from '@/services/offline/offlineMedia.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

// One saved cenote's offline download state, beside its name: a progress
// ring while downloading, a cloud-check once everything is on the device.
function CaveOfflineIndicator({ caveId }) {
  const { t } = useTranslation('offline')
  const status = useOfflineStatus(savedCaveStatusKey(caveId))
  if (!status) return null

  if (status.state === 'downloading') {
    const progress = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0
    return <CircularProgress variant="determinate" value={progress} size={16} thickness={5} aria-label={t('downloadingPercent', { progress })} />
  }
  const [Icon, label, color] = status.state === 'ready' ? [CloudDoneRounded, t('caveAvailable'), 'success'] : status.state === 'incomplete' ? [CloudOffRounded, t('caveIncompleteShort'), 'warning'] : [CloudOffRounded, t('caveNotYet'), 'disabled']
  return (
    <Tooltip title={label}>
      <Icon fontSize="small" color={color} aria-label={label} />
    </Tooltip>
  )
}

// Summary line under the section title.
function OfflineSummary() {
  const { t } = useTranslation('offline')
  const summary = useSavedCavesOfflineSummary()
  if (!summary) return null

  const text =
    summary.state === 'downloading'
      ? t('downloadingCount', { done: summary.done, total: summary.total })
      : summary.state === 'waiting'
        ? navigator.onLine
          ? t('waitingForWifi')
          : t('waitingForConnection')
        : summary.state === 'incomplete'
          ? t('savedIncomplete')
          : t('savedAvailable')
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} aria-live="polite">
      {text}
    </Typography>
  )
}

// The account page's "Saved cenotes" section: every cave the user saved from
// the result pane's Save quick action, most recently saved first.
// headingProps: the page's section heading style (see Account).
export default function SavedCavesList({ headingProps = {} }) {
  const { t } = useTranslation('account', { keyPrefix: 'savedCaves' })
  const { t: tMap } = useTranslation('map')
  const { loading, savedCaveIds, unsaveCave, restoreCave } = useSavedCaves()
  const [openSnackbar, closeSnackbar] = useSnackbar()

  // Removed: said, with Undo.
  function remove(caveId, name) {
    unsaveCave(caveId)
      .then((previous) =>
        openSnackbar(t('removed', { name }), {
          action: (
            <Button color="secondary" onClick={() => { closeSnackbar(); restoreCave(caveId, previous).catch((error) => console.error(error)) }}>
              {t('undo')}
            </Button>
          ),
        }),
      )
      .catch((error) => console.error(error))
  }
  const caves = useSelector((state) => state.data.caves)

  // Cave names come from the shared cave data, which the map normally loads -
  // make sure it's there when this page is opened directly.
  useEffect(() => {
    getData().catch(() => {})
  }, [])

  // A saved cave that no longer exists (deleted since) is skipped.
  const savedCaves = useMemo(() => {
    const cavesById = new Map(caves.map((cave) => [cave.id, cave]))
    return savedCaveIds.map((id) => cavesById.get(id)).filter(Boolean)
  }, [caves, savedCaveIds])

  return (
    <Box component="section" className="oc-saved-caves-list">
      <Typography component="h2" variant="h6" {...headingProps}>
        {t('title')}
      </Typography>
      {offlineSupported && savedCaves.length > 0 && <OfflineSummary />}
      {loading ? (
        <ListSkeleton rows={3} leading="circle" fill={false} />
      ) : savedCaves.length === 0 ? (
        <Typography color="text.secondary">{t('empty')}</Typography>
      ) : (
        <List disablePadding>
          {savedCaves.map((cave) => {
            const caveName = cave.name?.value || tMap('caveNameUnknown')
            const sistemaName = cave.sistemas?.[0]?.name
            return (
              <ListItem
                key={cave.id}
                disablePadding
                divider
                secondaryAction={
                  <Tooltip title={t('remove')}>
                    <IconButton edge="end" aria-label={t('removeNamed', { name: caveName })} onClick={() => remove(cave.id, caveName)}>
                      <BookmarkRemoveRounded />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton component={Link} to={`/map/${cave.id}`}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Bookmark sx={{ color: 'var(--oc-marker-saved-badge-color, #ffc107)' }} />
                  </ListItemIcon>
                  <ListItemText primary={caveName} secondary={sistemaName ? t('sistema', { name: sistemaName }) : undefined} />
                  {offlineSupported && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, mr: 1 }}>
                      <CaveOfflineIndicator caveId={cave.id} />
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      )}
    </Box>
  )
}
