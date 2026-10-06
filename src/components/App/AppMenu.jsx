import { useId, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Button, Popover, Tooltip, useTheme } from '@mui/material'
import AppMenuIcon from './AppMenuIcon.jsx'
import AppMenuPanel from './AppMenuPanel.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'

// The account button (avatar, or the logo when signed out) and its account
// card. The card holds buttons and links, not just menu items, so it's a
// labeled dialog-style Popover rather than an ARIA menu (which may only
// contain menu items).
export default function AppMenu({ sx, logoColorScheme, logoSx, avatarSx, className, ...props }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const isSmall = useSmall()
  const theme = useTheme()
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const panelId = useId()
  const titleId = useId()

  const menuStyles = {
    minWidth: 'unset',
    borderRadius: '50%',
    // The paper's colour of the current mode (theme.vars: palette.* is the
    // light one only - a white circle in dark mode).
    bgcolor: !isSmall && !isLoggedIn && theme.vars.palette.background.paper,
    ':hover': {
      bgcolor: !isSmall && !isLoggedIn && theme.vars.palette.background.paper,
    },
  }

  function handleClose() {
    setAnchorEl(null)
  }

  return (
    <>
      <Tooltip title={t('tooltip')}>
        <Button {...props} className={`oc-app-menu ${className || ''}`.trim()} variant={isSmall ? 'text' : 'contained'} aria-label={t('ariaLabel')} onClick={(event) => setAnchorEl(event.currentTarget)} aria-controls={open ? panelId : undefined} aria-haspopup="dialog" aria-expanded={open ? 'true' : undefined} sx={[sx, menuStyles]}>
          <AppMenuIcon
            logoColorScheme={logoColorScheme}
            logoSx={logoSx}
            // The photo fills the button but for a small margin (the button's
            // own colour around it), unless sized by the caller (avatarSx).
            avatarSx={
              avatarSx || {
                width: 'calc(100% - 8px)',
                height: 'calc(100% - 8px)',
              }
            }
          />
        </Button>
      </Tooltip>
      <Popover
        className="oc-app-menu--popover"
        id={panelId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            elevation: 3,
            // M3 large container shape, on the tinted surface Google Maps'
            // account card uses; the sections inside are white.
            sx: (theme) => ({ mt: 1, borderRadius: 7, bgcolor: theme.vars.sys.color.surfaceContainerHigh, maxHeight: 'calc(100dvh - 80px)' }),
          },
        }}
      >
        <AppMenuPanel onClose={handleClose} titleId={titleId} />
      </Popover>
    </>
  )
}
