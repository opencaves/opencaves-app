
import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Divider, IconButton, Menu } from '@mui/material'
import MoreVert from '@mui/icons-material/MoreVertRounded'
import UseAsCoverImage, { UseViewAsThumbnail, useUseAsCoverImage } from './menuItems/UseAsCoverImage.jsx'
import DeleteMedia, { useDeleteMedia, useDeleteMediaConfirm } from './menuItems/DeleteMedia.jsx'
import { usePhotoActionItems } from './menuItems/PhotoActionItems.jsx'

/**
 * The gallery viewer's ⋮ menu (its toolbar), for everyone: Report this
 * photo ({@link usePhotoActionItems}; Share and Download are the toolbar's
 * own buttons); then Use as cover photo and, for a
 * 360° photo, Use this view as thumbnail (signed-in accounts), and Delete
 * (admins).
 *
 * @param {object} props - Also the button's (an IconButton's).
 * @param {import('@/models/CaveAsset.js').default} props.mediaAsset - The photo shown.
 * @param {(mediaAsset: import('@/models/CaveAsset.js').default) => void} [props.onBeforeDelete] - Called before it's deleted (the gallery moves on to another photo).
 */
export default function MediaPaneMenu({ mediaAsset, onBeforeDelete, ...props }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [anchorEl, setAnchorEl] = useState(null)
  const popoverActions = useRef(null)
  const resizeObserver = useRef(null)
  const open = Boolean(anchorEl)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const setDeleteMediaMenuItem = useDeleteMedia()
  const setUseAsCoverImageMenuItem = useUseAsCoverImage()
  const { requestDelete, dialog: deleteDialog } = useDeleteMediaConfirm({ onBeforeDelete })
  // Everyone's items, as the cave page's photo menu (PhotoItemMenu), but
  // Share and Download, the toolbar's own buttons; the menu closes itself on
  // any click (its onClick).
  const actionItems = usePhotoActionItems(mediaAsset, { inViewer: true })

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  // The menu is placed from its size when it opens, which its items haven't
  // reached yet (it came out ~24px wide, so right-aligned to the button it
  // ran off the screen): placed again whenever its size changes.
  function watchSize(paper) {
    resizeObserver.current = new ResizeObserver(() => popoverActions.current?.updatePosition())
    resizeObserver.current.observe(paper)
  }

  function unwatchSize() {
    resizeObserver.current?.disconnect()
    resizeObserver.current = null
  }

  return (
    <>
      <IconButton
        {...props}
        aria-label={t('ariaLabel')}
        onClick={handleClick}
        aria-controls={open ? 'media-pane-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={{
          color: 'var(--yarl__color_button, hsla(0, 0%, 100%, .8))'
        }}
        className='oc-media-pane-menu yarl__button'
      >
        <MoreVert />
      </IconButton>
      <Menu
        className="oc-media-pane-menu--menu"
        anchorEl={anchorEl}
        id='media-pane-menu'
        open={open}
        onClose={handleClose}
        action={popoverActions}
        onClick={() => {
          handleClose()
          // An item opening a dialog: focus off the menu's button first, or
          // the dialog hides the page with focus still inside it.
          const focused = /** @type {HTMLElement} */ (document.activeElement)
          focused?.blur()
        }}
        slotProps={{
          paper: {
            elevation: 2,
            sx: {
              mt: 1,
            },
          },
          list: {
            sx: { py: .5 },
          },
          transition: {
            onEntering: watchSize,
            onExited: unwatchSize,
          },
        }}

        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {actionItems}
        {/* Signed-in accounts' and admins' items, apart. */}
        {(setDeleteMediaMenuItem || setUseAsCoverImageMenuItem) && <Divider />}
        <UseAsCoverImage mediaAsset={mediaAsset} />
        <UseViewAsThumbnail mediaAsset={mediaAsset} />
        <DeleteMedia onClick={() => requestDelete(mediaAsset)} />
      </Menu>
      {deleteDialog}
    </>
  )
}