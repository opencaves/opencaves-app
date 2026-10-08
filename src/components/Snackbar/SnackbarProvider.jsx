import { createContext, useState } from 'react'
import { Box, IconButton } from '@mui/material'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import Close from '@mui/icons-material/CloseRounded'
import { useTranslation } from 'react-i18next'
import Snackbar from './Snackbar.jsx'

export const SnackbarContext = createContext(null)

export default function SnackbarProvider({ children }) {

  const [open, setOpen] = useState(false)
  const [_message, setMessage] = useState('')
  const [_children, setChildren] = useState()
  const [_showCloseButton, setShowCloseButton] = useState(false)
  const [_action, setAction] = useState(null)
  const [_sx, setSx] = useState({})
  const [_autoHide, setAutoHide] = useState(true)
  const [_hideOnClickAway, setHideOnClickAway] = useState(false)
  const [_severity, setSeverity] = useState(null)
  const [_icon, setIcon] = useState(null)
  const { t } = useTranslation('app', { keyPrefix: 'snackbar' })

  // 

  // severity 'success': a green check before the message (e.g. "saved");
  // icon: another icon there (green too with severity 'success').
  function openSnackbar({ message, autoHide = true, hideOnClickAway = false, action = null, showCloseButton = false, children = false, sx = {}, severity = null, icon = null }) {

    if (children) {
      setChildren(children)
      setAutoHide(false)
      setSx(sx)
    } else {
      setShowCloseButton(showCloseButton)
      setAction(action)
      setAutoHide(autoHide)
      setHideOnClickAway(hideOnClickAway)
    }

    setSeverity(severity)
    setIcon(icon)
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
        message={
          !_children &&
          (_severity === 'success' || _icon ? (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              {/* On the snackbar's inverse surface, a success green: the
                  lighter in the light theme (dark surface), the darker in the
                  dark theme. */}
              <Box component="span" sx={(theme) => ({ display: 'inline-flex', flex: 'none', '& .MuiSvgIcon-root': { fontSize: '1.25rem' }, ...(_severity === 'success' && { color: 'success.light', ...theme.applyStyles('dark', { color: 'success.dark' }) }) })}>
                {_icon || <CheckCircleRounded />}
              </Box>
              {_message}
            </Box>
          ) : (
            _message
          ))
        }
        autoHide={_autoHide}
        hideOnClickAway={_hideOnClickAway}
        onClose={closeSnackbar}
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