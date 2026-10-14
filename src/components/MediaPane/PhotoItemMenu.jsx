import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Divider, IconButton, Menu } from '@mui/material'
import MoreVert from '@mui/icons-material/MoreVertRounded'
import UseAsCoverImage, { useUseAsCoverImage } from '@/components/MediaPane/menuItems/UseAsCoverImage.jsx'
import { usePhotoActionItems } from '@/components/MediaPane/menuItems/PhotoActionItems.jsx'
import DeleteMedia, { useDeleteMedia, useDeleteMediaConfirm } from '@/components/MediaPane/menuItems/DeleteMedia.jsx'

// Kept from the sortable item around it: a press here (or in the menu and
// its dialog, portals whose events still bubble through React's tree) would
// start a drag, a Ctrl+Shift+Arrow would move the photo.
const keepFromItem = (event) => event.stopPropagation()

/**
 * A photo's ⋮ menu on a cave's page (its strip, Show all's grid), with the
 * gallery viewer's items (MediaPaneMenu): for everyone, Share, Download and
 * Report this photo ({@link usePhotoActionItems}); then Use as cover photo
 * for signed-in accounts (editors) and Delete for admins (to the trash,
 * confirmed first: {@link UseAsCoverImage}, {@link DeleteMedia}). Laid
 * over the photo's top corner, opposite the Cover badge (its parent is
 * positioned). In a grid, shown when its parent is hovered (always on a
 * touch screen); on a strip, a card's (CardOptionsMenu's look: always
 * there, its background on the item's hover).
 *
 * @param {object} props
 * @param {import('@/models/CaveAsset.js').default} props.mediaAsset - The photo.
 * @param {'grid'|'card'} [props.variant='grid'] - Its look.
 */
export default function PhotoItemMenu({ mediaAsset, variant = 'grid' }) {
  const { t } = useTranslation('mediaPane')
  const isEditor = useUseAsCoverImage()
  const isAdmin = useDeleteMedia()
  const [anchorEl, setAnchorEl] = useState(null)
  const { requestDelete, dialog } = useDeleteMediaConfirm()
  const open = Boolean(anchorEl)
  const menuId = `oc-photo-item-menu-${mediaAsset.id}`
  const close = () => setAnchorEl(null)
  const actionItems = usePhotoActionItems(mediaAsset, { onDone: close })

  return (
    <Box
      className="oc-photo-item-menu"
      onMouseDown={keepFromItem}
      onTouchStart={keepFromItem}
      onKeyDown={keepFromItem}
      data-open={open || undefined}
      sx={(theme) => ({
        position: 'absolute',
        zIndex: 2,
        top: 4,
        insetInlineEnd: 4,
        ...(variant === 'grid' && {
          // Shown on the photo's hover, while focused or open; always on a
          // touch screen (no hover).
          opacity: 0,
          transition: theme.transitions.create('opacity', { duration: theme.sys.motion.duration.standardDecelerate, easing: theme.sys.motion.easing.standardDecelerate }),
          '*:hover > &, &:focus-within, &[data-open]': { opacity: 1 },
          '@media (hover: none)': { opacity: 1 },
        }),
      })}
    >
      <IconButton
        aria-label={t('menu.ariaLabel')}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        size={variant === 'card' ? 'small' : 'medium'}
        // A 3D strip's tile's control (MediaStrip): its state on the copies.
        // Its dark background drawn in one piece on the strip (see-through).
        className={variant === 'card' ? 'oc-media-strip--live oc-media-strip--translucent' : undefined}
        sx={variant === 'card' ? {
          cursor: 'pointer',
          color: 'common.white',
          // Its background when the photo is hovered or it's open (on a 3D
          // strip, its copies told so: MediaStrip).
          '*:hover > * > &, [data-oc-hover] > * > &, &[aria-expanded], &:hover, &:focus-visible': { bgcolor: 'rgba(0, 0, 0, 0.75)' },
        } : (theme) => ({
          cursor: 'pointer',
          // On the photo, whatever it shows: a scrim of the theme's own.
          color: theme.vars.palette.text.primary,
          bgcolor: `rgb(${theme.vars.palette.background.paperChannel} / 0.8)`,
          '&:hover': { bgcolor: theme.vars.palette.background.paper },
        })}
      >
        <MoreVert />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {actionItems}
        {/* Signed-in accounts' and admins' items, apart. */}
        {(isEditor || isAdmin) && <Divider />}
        <UseAsCoverImage mediaAsset={mediaAsset} onClick={close} />
        {/* Delete (admins), apart. */}
        {isAdmin && <Divider />}
        <DeleteMedia onClick={() => {
          close()
          requestDelete(mediaAsset)
        }} />
      </Menu>
      {dialog}
    </Box>
  )
}
