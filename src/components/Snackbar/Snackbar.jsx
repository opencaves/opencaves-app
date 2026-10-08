import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Snackbar as MUISnackbar, Portal } from '@mui/material'
import Slide from '@mui/material/Slide'
import Close from '@mui/icons-material/CloseRounded'
import { SNACKBAR_DEFAULT_AUTO_HIDE_DURATION } from '@/config/app.js'

// onClose: told when it closes on its own (a click away, its close button,
// its time up), so whoever opened it knows it's closed - and can open it
// again (SnackbarProvider: a next message didn't show after a click away).
export default function Snackbar({ open = false, message, autoHide = true, autoHideDuration = null, hideOnClickAway = false, action = null, showCloseButton = false, onClose, children, sx = {} }) {

  const [_open, setOpen] = useState(open)
  const [_autoHideDuration, setAutoHideDuration] = useState(null)
  const { t } = useTranslation('app', { keyPrefix: 'snackbar' })

  function closeSnackbar() {
    setOpen(false)
    onClose?.()
  }

  function CloseButton() {
    return (
      <IconButton
        aria-label={t('close.ariaLabel')}
        color='inherit'
        sx={{ p: 0.5 }}
        onClick={closeSnackbar}
      >
        <Close />
      </IconButton>
    )
  }

  function onSnackbarClose(event, reason) {
    // A click elsewhere doesn't close it (M3: a snackbar leaves on its own,
    // or by its action or close button) - unless asked to. It also closed
    // the snackbar the clicked button had just opened.
    if (reason === 'clickaway' && !hideOnClickAway) return

    // Otherwise, close the snackbar
    closeSnackbar()
  }

  // function onSnackbarExited() {
  //   console.log('[onSnackbarExited]')
  // }

  useEffect(() => {
    setAutoHideDuration(autoHide ? autoHideDuration || SNACKBAR_DEFAULT_AUTO_HIDE_DURATION : null)
  }, [autoHide, autoHideDuration])

  useEffect(() => {
    setOpen(open)
  }, [open])

  // Returns the Provider that must wrap the application
  return (
    <Portal>
      <MUISnackbar
        className="oc-snackbar"
        autoHideDuration={_autoHideDuration}
        message={message}
        open={_open}
        slots={{ transition: Slide }}
        // Its action and close button centered beside the text (M3).
        slotProps={{ transition: { direction: 'up' } }}
        sx={children ? sx : {}}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <>
            {
              action
            }
            {
              autoHide ? (
                showCloseButton && <CloseButton />
              ) : (
                !action && (
                  <CloseButton />
                )
              )
            }
          </>
        }
        // TransitionProps={{ onExited: onSnackbarExited }}
        onClose={onSnackbarClose}
      >
        {children}
      </MUISnackbar>
    </Portal>
  )
}