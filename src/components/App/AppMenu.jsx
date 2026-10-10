import { useId, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Popover, Tooltip, useTheme } from '@mui/material'
import AppMenuIcon from './AppMenuIcon.jsx'
import AppMenuPanel from './AppMenuPanel.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useNewFeedbackCount } from '@/routes/feedback/useNewFeedbackCount.js'

/**
 * The account button (avatar, or the logo when signed out) and its account
 * card. The card holds buttons and links, not just menu items, so it's a
 * labeled dialog-style Popover rather than an ARIA menu (which may only
 * contain menu items). For admins, a badge on the button counts the new
 * feedback reports (in its accessible name too).
 */
export default function AppMenu({ sx, logoColorScheme, logoSx, avatarSx, className, ...props }) {
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const isAdmin = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn && state.session.roles.includes('admin'))
  const newFeedback = useNewFeedbackCount(isAdmin)
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
        <Button {...props} className={`oc-app-menu ${className || ''}`.trim()} variant={isSmall ? 'text' : 'contained'} aria-label={newFeedback ? `${t('ariaLabel')}, ${t('newFeedbackAria', { count: newFeedback })}` : t('ariaLabel')} onClick={(event) => setAnchorEl(event.currentTarget)} aria-controls={open ? panelId : undefined} aria-haspopup="dialog" aria-expanded={open ? 'true' : undefined} sx={[sx, menuStyles]}>
          {/* M3's large badge (16dp) in the app's gold, as the menu's and the
              dashboard's counts: the new feedback reports, admins only.
              aria-hidden: the button's name says it. */}
          <Badge
            className="oc-app-menu--badge"
            badgeContent={newFeedback}
            max={99}
            color="secondary"
            overlap="circular"
            invisible={!newFeedback}
            slotProps={{ badge: { 'aria-hidden': true } }}
            sx={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', '& .MuiBadge-badge': { height: 16, minWidth: 16, px: '4px', fontSize: '0.6875rem', fontWeight: 500, lineHeight: '16px' } }}
          >
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
          </Badge>
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
