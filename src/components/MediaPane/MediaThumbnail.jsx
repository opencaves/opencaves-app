import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, useTheme } from '@mui/material'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import MoreVert from '@mui/icons-material/MoreVert'
import Picture from '@/components/Picture.jsx'
import UseAsCoverImage from '@/components/MediaPane/menuItems/UseAsCoverImage.jsx'
import DeleteMedia, { useDeleteMediaConfirm } from '@/components/MediaPane/menuItems/DeleteMedia.jsx'
import noop from '@/utils/noop.js'
import { getStorageService } from '@/config/firebase.js'
import { mediaItemPadding, mediaItemRadius } from './config.js'

// How long the active thumbnail follows the list's growth after it becomes active.
const FOLLOW_GROWTH_MS = 2000

export default function MediaThumbnail({ mediaAsset, isActive, onBeforeDelete = noop, ...props }) {

  const { direction, palette } = useTheme()
  const { t } = useTranslation('mediaPane')
  const [anchorEl, setAnchorEl] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)


  const rootRef = useRef(null)

  // The photo shown in the viewer is kept in sight in the list, scrolled to
  // smoothly - when the pane opens on it, and as the viewer moves on. When
  // the pane opens, the thumbnails above are still unfolding (Collapse) and
  // loading: the scroll follows the list's growth for a moment, unless the
  // user scrolls it meanwhile.
  useEffect(() => {
    const node = rootRef.current
    if (!isActive || !node) {
      return
    }
    const reveal = () => node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const frame = requestAnimationFrame(reveal)
    const content = node.closest('.MuiCollapse-root')?.parentElement
    const observer = content && new ResizeObserver(reveal)
    observer?.observe(content)
    const stop = () => observer?.disconnect()
    const timer = setTimeout(stop, FOLLOW_GROWTH_MS)
    content?.addEventListener('wheel', stop, { once: true, passive: true })
    content?.addEventListener('touchstart', stop, { once: true, passive: true })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      stop()
      content?.removeEventListener('wheel', stop)
      content?.removeEventListener('touchstart', stop)
    }
  }, [isActive])

  const open = Boolean(anchorEl)
  const mediaThumbnailItemId = `media-thumbnail-item-${mediaAsset.id}`
  const activeStyles = isActive ? {
    outline: `1px solid var(--mui-palette-secondary-${palette.mode})`,
    outlineOffset: '4px',
    position: 'relative',
    ':before': {
      content: '""',
      position: 'absolute',
      left: -4,
      right: -4,
      top: -4,
      bottom: -4,
      background: 'rgb(var(--mui-palette-secondary-mainChannel) / 35%)',
      zIndex: -1,
      borderRadius: mediaItemRadius
    }
  } : {}

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  function onBeforeDeleteMedia() {
    onBeforeDelete(mediaAsset, isActive)
  }

  const { requestDelete, dialog: deleteDialog } = useDeleteMediaConfirm({ onBeforeDelete: onBeforeDeleteMedia })

  function onMenuClick() {
    setAnchorEl(null)
  }

  useEffect(() => {
    getStorageService()
      .then(({ storage, ref, getDownloadURL }) => getDownloadURL(ref(storage, mediaAsset.fullPath)))
      .then(url => setDownloadUrl(url))
  }, [mediaAsset])

  return (
    <Box
      {...props}
      ref={rootRef}
      className={`oc-media-thumbnail ${props.className || ''}`.trim()}
      sx={{
        '--_menu-opacity': 0,
        '--_menu-transition-duration': 'var(--mui-transition-duration-complex)',
        '--_menu-transition-delay': '.5s',
        px: `${mediaItemPadding}px`,
        '&:hover': {
          '--_menu-opacity': 1,
          '--_menu-transition-duration': 'var(--mui-transition-duration-shortest)',
          '--_menu-transition-delay': '0s',
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          // pb: 1
          mt: `${mediaItemPadding / 2}px`,
          mb: `${mediaItemPadding / 2}px`,
        }}
      >
        <ButtonBase
          component={Link}
          to={`../${mediaAsset.id}`}
          relative='path'
          replace
          aria-label={t('mediaThumbnailItem.openBtn.ariaLabel')}
          className="oc-media-thumbnail--link"
          sx={{
            borderRadius: mediaItemRadius,
            backgroundColor: '#181818',
            width: '100%',
            textAlign: 'center',
            ...activeStyles
          }}
        >
          <Picture
            sources={mediaAsset.getSources('mediaThumbnail')}
            style={{
              maxHeight: '600px',
              borderRadius: mediaItemRadius,
              justifyContent: 'center'
            }}
            loading='lazy'
            alt=''
          />
        </ButtonBase>
        <Box
          className="oc-media-thumbnail--toolbar"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            display: 'flex',
            flexDirection: direction === 'ltr' ? 'row-reverse' : 'row',
            px: '8px',
            pt: '8px',
            opacity: 'var(--_menu-opacity)',
            backgroundImage: 'linear-gradient(0deg,rgba(0,0,0,0),rgba(0,0,0,.4))',
            transition: 'opacity var(--_menu-transition-duration) linear var(--_menu-transition-delay)',
            borderRadius: `${mediaItemRadius} ${mediaItemRadius} 0 0`,
            // Only its buttons take clicks: the gradient strip lets them
            // through to the photo's link below.
            pointerEvents: 'none',
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          <IconButton
            aria-label={t('menu.ariaLabel')}
            id="long-button"
            aria-controls={open ? mediaThumbnailItemId : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            onClick={handleClick}
            sx={{
              color: '#fff'
            }}
          >
            <MoreVert />
          </IconButton>
          <Menu
            id={mediaThumbnailItemId}
            slotProps={{
              list: {
                'aria-labelledby': 'long-button',
              },
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: direction === 'ltr' ? 'right' : 'left'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: direction === 'ltr' ? 'right' : 'left'
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
          >
            <UseAsCoverImage mediaAsset={mediaAsset} onClick={onMenuClick} />
            <MenuItem component='a' href={downloadUrl} target='_blank' sx={{ '&:hover': { color: 'unset' } }} onClick={onMenuClick}>
              <ListItemIcon>
                <OpenInNewRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('menu.viewOriginalImage')}</ListItemText>
            </MenuItem>
            <DeleteMedia onClick={() => {
              onMenuClick()
              requestDelete(mediaAsset)
            }} />
          </Menu>
          {deleteDialog}
        </Box>
      </Box>
    </Box>
  )
}