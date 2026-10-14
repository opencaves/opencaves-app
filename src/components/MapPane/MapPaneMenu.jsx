import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import MoreVert from '@mui/icons-material/MoreVertRounded'
import { useMediaActionsFor } from '@/components/MediaPane/menuItems/mediaActions.jsx'
import { mediaMenuItems } from '@/components/MediaPane/menuItems/PhotoActionItems.jsx'

/**
 * The map viewer's ⋮ menu (its toolbar), as MediaPaneMenu in the photo
 * viewer, for everyone: Report this map ({@link useMediaActionsFor}; Share
 * and Download are the toolbar's own buttons); then
 * the Maps tab's own actions: Edit (`onEdit`, editors) and Move to trash
 * (`onTrash`, admins: to the trash; there's no removing a map from its
 * system alone, it left the map shown nowhere).
 *
 * @param {object} props - Also the button's (an IconButton's).
 * @param {CaveMap} props.map - The map shown.
 * @param {() => void} [props.onEdit]
 * @param {(map: CaveMap) => void} [props.onTrash]
 */
export default function MapPaneMenu({ map, onEdit, onTrash, ...props }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const { pathname } = useLocation()
  // Report this map only: Share and Download are the toolbar's own buttons.
  const mediaActions = useMediaActionsFor()({ kind: 'map', itemId: map?.id, reportPage: pathname, onDone: () => setAnchorEl(null) })

  function handleClose() {
    setAnchorEl(null)
  }

  // Focus leaves the menu's button before a dialog opens: the closing menu
  // hands focus back to it, and the dialog then hides the page (aria-hidden on
  // #root) with focus still inside it, which the browser blocks.
  function act(action) {
    handleClose()
    const focused = /** @type {HTMLElement} */ (document.activeElement)
    focused?.blur()
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
        <MoreVert />
      </IconButton>
      <Menu
        className="oc-map-pane-menu--menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {mediaMenuItems(mediaActions)}
        {/* Editors' and admins' items, apart. */}
        {(onEdit || onTrash) && <Divider />}
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
        {/* Move to trash (admins), apart from Edit. */}
        {onEdit && onTrash && <Divider />}
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
