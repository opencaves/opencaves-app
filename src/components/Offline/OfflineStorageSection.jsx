import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material'
import { DeleteSweepOutlined } from '@mui/icons-material'
import { clearOfflineMedia, offlineSupported } from '@/services/offline/offlineMedia.js'
import { setOfflinePreviewsEnabled } from '@/hooks/useOfflinePreviewsSetting.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

// The account page's "Offline use" section: how much this site stores on the
// device (navigator.storage.estimate(): cave data, downloaded and cached
// pictures/maps/map tiles, the app's own files) and a way to free the
// pictures and maps.
// headingProps: the page's section heading style (see Account).
export default function OfflineStorageSection({ headingProps = {} }) {
  const { t, i18n } = useTranslation('account', { keyPrefix: 'offline' })
  const [openSnackbar] = useSnackbar()
  const [estimate, setEstimate] = useState(null)
  const [persisted, setPersisted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setEstimate(await navigator.storage.estimate())
      setPersisted(await navigator.storage.persisted?.())
    } catch {
      setEstimate(null)
    }
  }, [])

  useEffect(() => {
    if (!navigator.storage?.estimate) return undefined
    refresh()
    // Downloads keep changing the total while this page is open.
    const intervalId = setInterval(refresh, 5000)
    return () => clearInterval(intervalId)
  }, [refresh])

  if (!offlineSupported || !navigator.storage?.estimate) {
    return null
  }

  const formatSize = (bytes) => {
    const [value, unit] = bytes >= 1e9 ? [bytes / 1e9, 'gigabyte'] : bytes >= 1e6 ? [bytes / 1e6, 'megabyte'] : [bytes / 1e3, 'kilobyte']
    return new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)
  }

  async function handleClear() {
    setClearing(true)
    try {
      // Otherwise the next sync would download everything right back.
      setOfflinePreviewsEnabled(false)
      await clearOfflineMedia()
      openSnackbar(t('cleared'))
    } catch (error) {
      console.error(error)
      openSnackbar(t('clearError'))
    } finally {
      setClearing(false)
      setConfirmOpen(false)
      refresh()
    }
  }

  return (
    <Box component="section" className="oc-offline-storage-section">
      <Typography component="h2" variant="h6" {...headingProps}>
        {t('title')}
      </Typography>
      <Typography sx={{ mb: 0.5 }}>{estimate ? t('used', { size: formatSize(estimate.usage || 0) }) : t('measuring')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {persisted ? t('persisted') : t('notPersisted')}
      </Typography>
      {/* Centered on phones. */}
      <Button variant="outlined" color="error" startIcon={<DeleteSweepOutlined />} onClick={() => setConfirmOpen(true)} disabled={clearing} sx={{ display: 'flex', width: 'fit-content', mx: { xs: 'auto', sm: 0 } }}>
        {t('clear')}
      </Button>

      <Dialog className="oc-offline-storage-section--confirm" open={confirmOpen} onClose={() => !clearing && setConfirmOpen(false)} aria-labelledby="oc-offline-clear-title">
        <DialogTitle id="oc-offline-clear-title">{t('confirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('confirmText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={clearing}>
            {t('cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleClear} disabled={clearing} startIcon={clearing ? <CircularProgress size={16} /> : undefined}>
            {t('confirmClear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
