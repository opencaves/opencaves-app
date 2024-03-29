import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getDownloadURL, ref } from 'firebase/storage'
import { Box, ButtonBase, IconButton, Menu, MenuItem, useTheme } from '@mui/material'
import { MoreVert } from '@mui/icons-material'
import Picture from '@/components/Picture'
import UseAsCoverImage from '@/components/MediaPane/menuItems/UseAsCoverImage'
import DeleteMedia from '@/components/MediaPane/menuItems/DeleteMedia'
import noop from '@/utils/noop'
import { storage } from '@/config/firebase'
import { mediaItemPadding, mediaItemRadius } from './config'

export default function MediaThumbnail({ mediaAsset, isActive, onBeforeDelete = noop, ...props }) {

  const { direction, palette } = useTheme()
  const { t } = useTranslation('mediaPane')
  const [anchorEl, setAnchorEl] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)


  const open = Boolean(anchorEl)
  const mediaThumbnailItemId = `media-thumbnail-item-${mediaAsset.id}`
  const activeStyles = isActive ? {
    outline: `1px solid var(--md-palette-secondary-${palette.mode})`,
    outlineOffset: '4px',
    position: 'relative',
    ':before': {
      content: '""',
      position: 'absolute',
      left: -4,
      right: -4,
      top: -4,
      bottom: -4,
      background: 'rgb(var(--md-palette-secondary-mainChannel) / 35%)',
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

  function onMenuClick() {
    setAnchorEl(null)
  }

  useEffect(() => {
    getDownloadURL(ref(storage, mediaAsset.fullPath)).then(url => setDownloadUrl(url))
  }, [mediaAsset])

  return (
    <Box
      {...props}
      sx={{
        '--_menu-opacity': 0,
        '--_menu-transition-duration': 'var(--md-transition-duration-complex)',
        '--_menu-transition-delay': '.5s',
        px: `${mediaItemPadding}px`,
        '&:hover': {
          '--_menu-opacity': 1,
          '--_menu-transition-duration': 'var(--md-transition-duration-shortest)',
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
          position='absolute'
          left={0}
          right={0}
          top={0}
          display='flex'
          flexDirection={direction === 'ltr' ? 'row-reverse' : 'row'}
          px='8px'
          pt='8px'
          sx={{
            opacity: 'var(--_menu-opacity)',
            backgroundImage: 'linear-gradient(0deg,rgba(0,0,0,0),rgba(0,0,0,.4))',
            transition: 'opacity var(--_menu-transition-duration) linear var(--_menu-transition-delay)',
            borderRadius: `${mediaItemRadius} ${mediaItemRadius} 0 0`
          }}
        >
          <IconButton
            aria-label="more"
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
            MenuListProps={{
              'aria-labelledby': 'long-button',
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
            <MenuItem component='a' href={downloadUrl} target='_blank' sx={{ '&:hover': { color: 'unset' } }} onClick={onMenuClick}>{t('menu.viewOriginalImage')}</MenuItem>
            <DeleteMedia mediaAsset={mediaAsset} onBeforeDelete={onBeforeDeleteMedia} onClick={onMenuClick} />
          </Menu>
        </Box>
      </Box>
    </Box>
  )
}