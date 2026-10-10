import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Snackbar as MUISnackbar, Portal } from '@mui/material'
import Slide from '@mui/material/Slide'
import Close from '@mui/icons-material/CloseRounded'
import { SNACKBAR_DEFAULT_AUTO_HIDE_DURATION } from '@/config/app.js'

/**
 * @param {object} props
 * @param {boolean} [props.open=false]
 * @param {import('react').ReactNode} [props.message]
 * @param {boolean} [props.autoHide=true]
 * @param {number|null} [props.autoHideDuration=null]
 * @param {boolean} [props.hideOnClickAway=false]
 * @param {import('react').ReactNode} [props.action=null]
 * @param {boolean} [props.showCloseButton=false]
 * @param {import('react').ReactNode} [props.children] - Shown instead of the message.
 * @param {object} [props.sx={}] - Applied with children only.
 * @param {() => void} [props.onClose] - Told when it closes on its own (a click away, its close button,
 *   its time up), so whoever opened it knows it's closed - and can open it
 *   again (SnackbarProvider: a next message didn't show after a click away).
 */
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
        slotProps={{ transition: /** @type {import('@mui/material/transitions').TransitionProps} */ ({ direction: 'up' }) }}
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
        {/** @type {import('react').ReactElement} */ (children)}
      </MUISnackbar>
    </Portal>
  )
}