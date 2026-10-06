import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import MoreVert from '@mui/icons-material/MoreVert'

// Mirrors MediaPaneMenu.jsx's role in the picture viewer: a toolbar button
// injected into the Lightbox with the same edit/delete actions already
// available from the Maps tab's own three-dot menu. `onTrash` (admins)
// deletes the map, to the trash; there's no removing a map from its system
// alone (it left the map shown nowhere).
export default function MapPaneMenu({ map, onEdit, onTrash, ...props }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  function handleClose() {
    setAnchorEl(null)
  }

  // Focus leaves the menu's button before a dialog opens: the closing menu
  // hands focus back to it, and the dialog then hides the page (aria-hidden on
  // #root) with focus still inside it, which the browser blocks.
  function act(action) {
    handleClose()
    document.activeElement?.blur()
    action(map)
  }

  return (
    <>
      <IconButton
        {...props}
        aria-label={t('mapOptions')}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="true"
        sx={{ color: 'var(--yarl__color_button, hsla(0, 0%, 100%, .8))' }}
        className="oc-map-pane-menu yarl__button"
      >
        <MoreVert sx={{ fontSize: '1.75rem' }} />
      </IconButton>
      <Menu
        className="oc-map-pane-menu--menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {onEdit && (
          <MenuItem
            onClick={() => act(onEdit)}
          >
            <ListItemIcon>
              <EditRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('editMap')}</ListItemText>
          </MenuItem>
        )}
        {onTrash && (
          <MenuItem
            className="oc-map-pane-menu--trash"
            onClick={() => act(onTrash)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <DeleteForeverRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('trashMap')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  )
}
