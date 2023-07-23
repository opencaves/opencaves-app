import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Snackbar, Slide } from '@mui/material'
import { useServiceWorker } from '../../hooks/useServiceWorker'
import { useCheckForAppUpdates } from '../../hooks/useCheckForAppUpdates'

function TransitionTop(props) {
  return <Slide {...props} direction="up" />
}

export default function ManageAppUpdate() {
  const { waitingWorker, showReload, reloadPage } = useServiceWorker(1000)
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('app')

  const appHasUpdate = useCheckForAppUpdates()

  function onShackbarBtnClick() {
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
      open={open}
      message={t('updateAvailable.message')}
      action={
        <Button
          color='secondary'
          onClick={onShackbarBtnClick}
        >
          {t('updateAvailable.btn')
          }</Button>}
      TransitionComponent={TransitionTop}
    />
  )
}