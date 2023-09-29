import { useEffect, useState } from 'react'
import { IconButton, Snackbar as MUISnackbar, Portal } from '@mui/material'
import Slide from '@mui/material/Slide'
import { snackbarAutoHideDuration } from '@/config/app'
import { Close } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

function SlideUp(props) {
  return <Slide {...props} direction='up' />
}

export default function Snackbar({ open = false, message, autoHide = true, action = null, showCloseButton = false, children, sx = {} }) {

  const [_open, setOpen] = useState(open)
  const [autoHideDuration, setAutoHideDuration] = useState(null)
  const { t } = useTranslation('app', { keyPrefix: 'snackbar' })

  function closeSnackbar() {
    setOpen(false)
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
    if (!autoHide && reason === 'clickaway') {
      // Don't close the snackbar on click away when option autoHide === false
      return
    }

    // Otherwise, close the snackbar
    closeSnackbar()
  }

  useEffect(() => {
    setAutoHideDuration(autoHide ? snackbarAutoHideDuration : null)
  }, [autoHide])

  useEffect(() => {
    setOpen(open)
  }, [open])

  // Returns the Provider that must wrap the application
  return (
    <Portal>
      <MUISnackbar
        autoHideDuration={autoHideDuration}
        message={message}
        open={_open}
        ContentProps={{ sx: { alignItems: 'flex-start' } }}
        sx={
          children ? sx : {
            '& .MuiSnackbarContent-action': {
              pt: .5
            }
          }
        }
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
        TransitionComponent={SlideUp}
        onClose={onSnackbarClose}
      >
        {children}
      </MUISnackbar>
    </Portal>
  )
}