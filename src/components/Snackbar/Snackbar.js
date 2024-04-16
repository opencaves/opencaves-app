import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Snackbar as MUISnackbar, Portal } from '@mui/material'
import Slide from '@mui/material/Slide'
import { Close } from '@mui/icons-material'
import { snackbarDefaultAutoHideDuration } from '@/config/app'

const SlideUp = forwardRef((props, ref) => {
  return <Slide {...props} ref={ref} direction='up' />
})

export default function Snackbar({ open = false, message, autoHide = true, autoHideDuration = null, hideOnClickAway = false, action = null, showCloseButton = false, children, sx = {} }) {

  const [_open, setOpen] = useState(open)
  const [_autoHideDuration, setAutoHideDuration] = useState(null)
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
    if (!autoHide && !hideOnClickAway && reason === 'clickaway') {
      // Don't close the snackbar on click away when option autoHide === false
      return
    }

    // Otherwise, close the snackbar
    closeSnackbar()
  }

  // function onSnackbarExited() {
  //   console.log('[onSnackbarExited]')
  // }

  useEffect(() => {
    setAutoHideDuration(autoHide ? autoHideDuration || snackbarDefaultAutoHideDuration : null)
  }, [autoHide, autoHideDuration])

  useEffect(() => {
    setOpen(open)
  }, [open])

  // Returns the Provider that must wrap the application
  return (
    <Portal>
      <MUISnackbar
        autoHideDuration={_autoHideDuration}
        message={message}
        open={_open}
        ContentProps={{ sx: { alignItems: 'flex-start' } }}
        sx={
          children ? sx : {
            '& .MuiSnackbarContent-action': {
              pt: .25
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
        // TransitionProps={{ onExited: onSnackbarExited }}
        onClose={onSnackbarClose}
      >
        {children}
      </MUISnackbar>
    </Portal>
  )
}