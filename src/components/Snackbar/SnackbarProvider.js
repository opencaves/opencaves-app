import { createContext, useState } from 'react'
import { IconButton } from '@mui/material'
import { Close } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import Snackbar from './Snackbar'

export const SnackbarContext = createContext(null)

export default function SnackbarProvider({ children }) {

  const [open, setOpen] = useState(false)
  const [_message, setMessage] = useState('')
  const [_children, setChildren] = useState()
  const [_showCloseButton, setShowCloseButton] = useState(false)
  const [_action, setAction] = useState(null)
  const [_sx, setSx] = useState({})
  const [_autoHide, setAutoHide] = useState(true)
  const { t } = useTranslation('app', { keyPrefix: 'snackbar' })

  // 

  function openSnackbar({ message, autoHide = true, action = null, showCloseButton = false, children = false, sx = {} }) {

    if (children) {
      setChildren(children)
      setAutoHide(false)
      setSx(sx)
    } else {
      setShowCloseButton(showCloseButton)
      setAction(action)
      setAutoHide(autoHide)
    }

    setMessage(message)
    setOpen(true)
  }

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

  // Returns the Provider that must wrap the application
  return (
    <SnackbarContext.Provider value={{ openSnackbar, closeSnackbar }}>
      {children}
      <Snackbar
        open={open}
        message={!_children && _message}
        autoHide={_autoHide}
        action={
          <>
            {
              _action
            }
            {
              _autoHide ? (
                _showCloseButton && <CloseButton />
              ) : (
                !_action && (
                  <CloseButton />
                )
              )
            }
          </>
        }
        sx={_sx}
      >
        {_children && _message}
      </Snackbar>
    </SnackbarContext.Provider>
  )
}