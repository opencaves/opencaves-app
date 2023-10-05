
import { useState } from 'react'
import { Link, useLoaderData, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { IconButton, Menu, Divider, ListItemIcon } from '@mui/material'
import { MoreVert } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem'
import UseAsCoverImage from './menuItems/UseAsCoverImage'
import { appName } from '@/config/app'
import DeleteMedia from './menuItems/DeleteMedia.js'

export default function MediaPaneMenu({ ...props }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const { mediaId } = useParams()
  const mediaAssets = useLoaderData()
  console.log('mediaAssets: %o', mediaAssets)
  const mediaAsset = mediaAssets.docs.find(media => media.data().id === mediaId).data()

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
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
          color: 'var(--yarl__color_button,hsla(0,0%,100%,.8))'
        }}
        className='yarl__button'
      >
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id='media-pane-menu'
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        slotProps={{
          paper: {
            elevation: 2,
            sx: {
              mt: 1,
            },
          }
        }}
        MenuListProps={{
          sx: { py: .5 }
        }}

        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <UseAsCoverImage mediaAsset={mediaAsset} />
        <DeleteMedia mediaAsset={mediaAsset} />
      </Menu>
    </>
  )
}