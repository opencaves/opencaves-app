import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'

// Kept from a sortable card around it (a press would start a drag, a
// Ctrl+Shift+Arrow move the card).
const keepFromCard = (event) => event.stopPropagation()

/**
 * A single "more options" trigger (vertical three dots, top-right of a
 * media/map/video card) opening a menu of actions - replaces what used to
 * be a row of always-visible icon buttons, so a card's overlay chrome stays
 * to one control no matter how many actions it has. Its background shows
 * when the card is hovered. Its presses are kept from a sortable card
 * around it (they'd start a drag).
 *
 * @param {object} props
 * @param {string} props.ariaLabel - The trigger's.
 * @param {{ label: string, icon: import('react').ReactNode, onClick?: () => void, to?: string, danger?: boolean }[]} props.actions - The
 *   menu's items (`to`: a link); `danger` ones in the error color.
 * @param {Sx} [props.sx] - The trigger's placement on a card with a title bar (centred on it).
 * @param {boolean} [props.reveal=false] - Shown only on its card's hover (in a grid), while focused or open; always on a
 *   touch screen.
 */
export default function CardOptionsMenu({ ariaLabel, actions, sx, reveal = false }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  function handleClose() {
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        size="small"
        // A 3D strip's tile's control (MediaStrip): its state on the copies.
        className="oc-card-options-menu oc-media-strip--live"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        onMouseDown={keepFromCard}
        onTouchStart={keepFromCard}
        onKeyDown={keepFromCard}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          // Above a card's title bar, which it sits on.
          zIndex: 2,
          color: 'common.white',
          bgcolor: 'transparent',
          // Its background when its card is hovered or it's open (on a 3D
          // strip, its copies told so: MediaStrip).
          '*:hover > &, [data-oc-hover] > &, &:hover, &[aria-expanded]': { bgcolor: 'rgba(0, 0, 0, 0.75)' },
          ...(reveal && {
            opacity: 0,
            transition: (theme) => theme.transitions.create(['opacity', 'background-color'], { duration: theme.sys.motion.duration.standardDecelerate, easing: theme.sys.motion.easing.standardDecelerate }),
            '*:hover > &, &:focus-visible, &[aria-expanded]': { opacity: 1 },
            '@media (hover: none)': { opacity: 1 },
          }),
          ...sx,
        }}
      >
        <MoreVertRounded />
      </IconButton>
      {/* Its events bubble through React's tree to the card too. */}
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onMouseDown={keepFromCard} onTouchStart={keepFromCard}>
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            component={action.to ? Link : 'li'}
            to={action.to}
            onClick={() => {
              handleClose()
              // Focus off the menu's button first: an action opening a dialog
              // would otherwise hide the page with focus still inside it.
              const focused = /** @type {HTMLElement} */ (document.activeElement)
              focused?.blur()
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
