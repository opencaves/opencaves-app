import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, LinearProgress, ListItemButton, ListItemIcon, ListItemText, Switch } from '@mui/material'
import CloudDoneRounded from '@mui/icons-material/CloudDoneRounded'
import CloudDownloadRounded from '@mui/icons-material/CloudDownloadRounded'
import { setOfflinePreviewsEnabled, useOfflinePreviewsEnabled } from '@/hooks/useOfflinePreviewsSetting.jsx'
import { useOfflineStatus } from '@/hooks/useOfflineStatus.jsx'
import { offlineSupported, previewsStatusKey } from '@/services/offline/offlineMedia.js'

// How long the row stays in the success colour once the download finishes,
// and says the files were removed once they are.
const DONE_HIGHLIGHT_MS = 6000

// The bar in place of the secondary text's one line, as tall as it (body2's
// line height), so the row keeps its height.
const PROGRESS_SX = { height: 4, borderRadius: 2, my: 'calc((1.43em - 4px) / 2)' }

/**
 * The "Make available offline" setting in the account menu: opt-in (per
 * device) download of every cave's cover thumbnail and every map for offline
 * use - done by OfflineMediaSync; this row shows its progress (a bar), then
 * that it's done (a cloud with a check, green for a few seconds); turned
 * off, a bar deflating as the files are removed. The whole row
 * is the switch (role/aria-checked); the Switch itself is decorative.
 */
export default function OfflinePreviewsToggle({ sx }) {
  const { t } = useTranslation('offline')
  const enabled = useOfflinePreviewsEnabled()
  const status = useOfflineStatus(previewsStatusKey)
  // Just finished downloading: in the success colour for a few seconds, then
  // faded back to the regular colours.
  // Just emptied (turned off): says so for as long.
  const [justDone, setJustDone] = useState(false)
  const [justRemoved, setJustRemoved] = useState(false)
  const previous = useRef(status?.state)
  useEffect(() => {
    const was = previous.current
    previous.current = status?.state
    if (was === 'removing' && status?.state === undefined) {
      setJustRemoved(true)
      const timer = setTimeout(() => setJustRemoved(false), DONE_HIGHLIGHT_MS)
      return () => clearTimeout(timer)
    }
    setJustRemoved(false)
    if (status?.state !== 'ready' || was === 'ready' || was === undefined) return
    setJustDone(true)
    const timer = setTimeout(() => setJustDone(false), DONE_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [status?.state])

  if (!offlineSupported) {
    return null
  }

  /** @type {import('react').ReactNode} */
  let secondary = justRemoved && !enabled ? t('previewsRemoved') : t('previewsHint')
  if (status?.state === 'removing') {
    // Turned off: the bar deflates as the files are removed.
    const left = status.total - status.done
    secondary = (
      <LinearProgress className="oc-offline-previews-toggle--progress" variant="determinate" value={status.total ? (left / status.total) * 100 : 0}
        aria-label={t('removingCount', { count: left })} sx={PROGRESS_SX} />
    )
  } else if (enabled && status) {
    if (status.state === 'waiting') secondary = navigator.onLine ? t('waitingForWifi') : t('waitingForConnection')
    else if (status.state === 'downloading') {
      // A progress bar while it downloads, its count for screen readers.
      const progress = status.total ? Math.round((status.done / status.total) * 100) : 0
      secondary = (
        <LinearProgress className="oc-offline-previews-toggle--progress" variant={status.total ? 'determinate' : 'indeterminate'} value={progress}
          aria-label={t('downloadingCount', { done: status.done, total: status.total })} sx={PROGRESS_SX} />
      )
    } else if (status.state === 'incomplete') secondary = t('previewsIncompleteShort')
    else if (status.state === 'ready') secondary = t('previewsComplete', { count: status.total })
  }
  const ready = enabled && status?.state === 'ready'

  return (
    <ListItemButton className="oc-offline-previews-toggle" role="switch" aria-checked={enabled} onClick={() => setOfflinePreviewsEnabled(!enabled)} sx={sx}>
      {/* Downloaded: a cloud with a check (green just after it finishes). */}
      <ListItemIcon sx={{ transition: 'color 1s', ...(ready && justDone && { color: 'success.main' }) }}>{ready ? <CloudDoneRounded /> : <CloudDownloadRounded />}</ListItemIcon>
      <ListItemText primary={t('previewsLabel')} secondary={secondary} slotProps={{ secondary: { component: 'div', sx: { transition: 'color 1s', ...(ready && justDone && { color: 'success.main' }) } } }} />
      {/* inert: its own checkbox input would otherwise be a control nested
          inside this one. */}
      <Box component="span" inert sx={{ display: 'inline-flex', ml: 1, pointerEvents: 'none' }}>
        <Switch edge="end" checked={enabled} />
      </Box>
    </ListItemButton>
  )
}
