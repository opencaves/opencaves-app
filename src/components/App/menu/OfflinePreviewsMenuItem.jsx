import { useTranslation } from 'react-i18next'
import { Box, ListItemIcon, ListItemText, Switch } from '@mui/material'
import { CloudDownloadOutlined } from '@mui/icons-material'
import MenuItem from '../MenuItem.jsx'
import { setOfflinePreviewsEnabled, useOfflinePreviewsEnabled } from '@/hooks/useOfflinePreviewsSetting.jsx'
import { useOfflineStatus } from '@/hooks/useOfflineStatus.jsx'
import { offlineSupported, previewsStatusKey } from '@/services/offline/offlineMedia.js'

// The "Offline" setting: opt-in (per device) download of every cave's cover
// thumbnail and every map for offline use - done by OfflineMediaSync; this
// item shows its progress. Keeps the
// menu open when toggled, like a settings switch.
export default function OfflinePreviewsMenuItem() {
  const { t } = useTranslation('offline')
  const enabled = useOfflinePreviewsEnabled()
  const status = useOfflineStatus(previewsStatusKey)

  if (!offlineSupported) {
    return null
  }

  function toggle(event) {
    event.stopPropagation()
    setOfflinePreviewsEnabled(!enabled)
  }

  let secondary = t('previewsHint')
  if (enabled && status) {
    if (status.state === 'waiting') secondary = navigator.onLine ? t('waitingForWifi') : t('waitingForConnection')
    else if (status.state === 'downloading') secondary = t('downloadingCount', { done: status.done, total: status.total })
    else if (status.state === 'incomplete') secondary = t('previewsIncompleteShort')
    else if (status.state === 'ready') secondary = t('previewsAvailable', { count: status.total })
  }

  return (
    <MenuItem className="oc-offline-previews-menu-item" onClick={toggle} role="menuitemcheckbox" aria-checked={enabled}>
      <ListItemIcon>
        <CloudDownloadOutlined fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={t('previewsLabel')} secondary={secondary} slotProps={{ secondary: { sx: { maxWidth: 220, whiteSpace: 'normal' } } }} />
      {/* Decorative: the menu item itself is the checkbox (role/aria-checked).
          inert keeps the switch's own checkbox input out of the
          accessibility tree and tab order - otherwise it'd be an
          interactive control nested inside the menu item. */}
      <Box component="span" inert sx={{ display: 'inline-flex', ml: 1, pointerEvents: 'none' }}>
        <Switch edge="end" size="small" checked={enabled} />
      </Box>
    </MenuItem>
  )
}
