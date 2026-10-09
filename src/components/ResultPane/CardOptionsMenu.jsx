import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'

// A single "more options" trigger (vertical three dots, top-right of a
// media/map/video card) opening a menu of actions - replaces what used to
// be a row of always-visible icon buttons, so a card's overlay chrome stays
// to one control no matter how many actions it has.
// sx: the trigger's placement on a card with a title bar (centred on it).
export default function CardOptionsMenu({ ariaLabel, actions, sx }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  function handleClose() {
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={ariaLabel}
        aria-haspopup="true"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          // Above a card's title bar, which it sits on.
          zIndex: 2,
          color: 'common.white',
          bgcolor: open ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.75)' },
          ...sx,
        }}
      >
        <MoreVertRounded />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            component={action.to ? Link : 'li'}
            to={action.to}
            onClick={() => {
              handleClose()
              // Focus off the menu's button first: an action opening a dialog
              // would otherwise hide the page with focus still inside it.
              document.activeElement?.blur()
              action.onClick?.()
            }}
            sx={action.danger ? { color: 'error.main' } : undefined}
          >
            <ListItemIcon sx={action.danger ? { color: 'error.main' } : undefined}>{action.icon}</ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
