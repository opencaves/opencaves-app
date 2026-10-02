import { useTranslation } from 'react-i18next'
import { Box, ListItemButton, ListItemIcon, ListItemText, Switch } from '@mui/material'
import CloudDownloadOutlined from '@mui/icons-material/CloudDownloadOutlined'
import { setOfflinePreviewsEnabled, useOfflinePreviewsEnabled } from '@/hooks/useOfflinePreviewsSetting.jsx'
import { useOfflineStatus } from '@/hooks/useOfflineStatus.jsx'
import { offlineSupported, previewsStatusKey } from '@/services/offline/offlineMedia.js'

// The "Make available offline" setting in the account menu: opt-in (per
// device) download of every cave's cover thumbnail and every map for offline
// use - done by OfflineMediaSync; this row shows its progress. The whole row
// is the switch (role/aria-checked); the Switch itself is decorative.
export default function OfflinePreviewsToggle({ sx }) {
  const { t } = useTranslation('offline')
  const enabled = useOfflinePreviewsEnabled()
  const status = useOfflineStatus(previewsStatusKey)

  if (!offlineSupported) {
    return null
  }

  let secondary = t('previewsHint')
  if (enabled && status) {
    if (status.state === 'waiting') secondary = navigator.onLine ? t('waitingForWifi') : t('waitingForConnection')
    else if (status.state === 'downloading') secondary = t('downloadingCount', { done: status.done, total: status.total })
    else if (status.state === 'incomplete') secondary = t('previewsIncompleteShort')
    else if (status.state === 'ready') secondary = t('previewsAvailable', { count: status.total })
  }

  return (
    <ListItemButton className="oc-offline-previews-toggle" role="switch" aria-checked={enabled} onClick={() => setOfflinePreviewsEnabled(!enabled)} sx={sx}>
      <ListItemIcon>
        <CloudDownloadOutlined />
      </ListItemIcon>
      <ListItemText primary={t('previewsLabel')} secondary={secondary} />
      {/* inert: its own checkbox input would otherwise be a control nested
          inside this one. */}
      <Box component="span" inert sx={{ display: 'inline-flex', ml: 1, pointerEvents: 'none' }}>
        <Switch edge="end" checked={enabled} />
      </Box>
    </ListItemButton>
  )
}
