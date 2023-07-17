import { useEffect, useState } from 'react'
import { Button, Snackbar, Slide } from '@mui/material'
import { useServiceWorker } from '../utils/useServiceWorker'
import { useTranslation } from 'react-i18next'

function TransitionTop(props) {
  return <Slide {...props} direction="up" />
}

export default function ManageAppReload() {
  const { waitingWorker, showReload, reloadPage } = useServiceWorker()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('app')

  function onShackbarBtnClick() {
    reloadPage()
  }

  // decides when to show the toast
  useEffect(() => {
    if (showReload && waitingWorker) {
      setOpen(true)
    }
  }, [waitingWorker, showReload, reloadPage])

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