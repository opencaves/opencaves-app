import { Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Typography } from '@mui/material'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useOnline } from '@/hooks/useOnline.jsx'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { markJustSaved } from '@/services/offline/offlineMedia.js'
import { requestPersistentStorage } from '@/utils/persistentStorage.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

/**
 * Offline, above a cave's photos or maps that aren't saved: only what was
 * viewed online is on the device - and how to keep all of it: save the
 * cenote (signed in; it downloads once back online), or create an account
 * first. Nothing online, nor for a saved cenote.
 *
 * @param {object} props
 * @param {string|null} [props.caveId=null] - The cave; without one (a cave system's page), the advice is
 *   to save one of its cenotes.
 */
export default function OfflineSaveHint({ caveId = null, sx }) {
  const { t } = useTranslation('offline', { keyPrefix: 'hint' })
  const { t: tQuick } = useTranslation('quickActions')
  const online = useOnline()
  const { canSave, isSaved, saveCave } = useSavedCaves()
  const [openSnackbar] = useSnackbar()
  const dispatch = useDispatch()
  const location = useLocation()

  if (online || (caveId && canSave && isSaved(caveId))) return null

  function save() {
    requestPersistentStorage()
    markJustSaved(caveId)
    openSnackbar(tQuick('savedDownloadWhenOnline'), { severity: 'success' })
    saveCave(caveId).catch((error) => {
      console.error(error)
      openSnackbar(tQuick('saveError'))
    })
  }

  const advice = !caveId ? t('system') : canSave ? t('save') : t('account')
  return (
    <Box className="oc-offline-save-hint" role="note" sx={[{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: 1.5, mb: 2, borderRadius: 3, bgcolor: 'var(--mui-sys-color-surfaceContainerHighest)' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <CloudOffRounded sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: '1 1 14rem' }}>
        {t('offline')} {advice}
      </Typography>
      {caveId && canSave && (
        <Button size="small" onClick={save}>
          {t('saveButton')}
        </Button>
      )}
      {caveId && !canSave && (
        <Button size="small" component={Link} to="/signup" onClick={() => dispatch(setContinueUrl(buildContinueUrl(location)))}>
          {t('signupButton')}
        </Button>
      )}
    </Box>
  )
}
