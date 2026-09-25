import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Snackbar, Slide } from '@mui/material'
import { useServiceWorker } from '@/hooks/useServiceWorker.jsx'
import { useCheckForAppUpdates } from '@/hooks/useCheckForAppUpdates.jsx'

export default function ManageAppUpdate() {
  const { waitingWorker, showReload, reloadPage } = useServiceWorker(1000)
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('app')

  const appHasUpdate = useCheckForAppUpdates()

  function onSnackbarBtnClick() {
    reloadPage()
  }

  // decides when to show the toast
  useEffect(() => {
    if (showReload && waitingWorker) {
      setOpen(true)
    }
  }, [waitingWorker, showReload, reloadPage])

  // Periodically check for service worker update
  useEffect(() => {
    if (appHasUpdate) {
      setOpen(true)
    }
  }, [appHasUpdate])

  return (
    <Snackbar
      className="oc-manage-app-update"
      open={open}
      message={t('updateAvailable.message')}
      action={
        <Button
          className="oc-manage-app-update--reload-button"
          color='secondary'
          onClick={onSnackbarBtnClick}
        >
          {t('updateAvailable.btn')
          }</Button>}
      slots={{ transition: Slide }}
      slotProps={{ transition: { direction: 'up' } }}
    />
  )
}