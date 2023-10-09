
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { IconButton, Menu } from '@mui/material'
import { MoreVert } from '@mui/icons-material'
import UseAsCoverImage from './menuItems/UseAsCoverImage'
import DeleteMedia from './menuItems/DeleteMedia'

export default function MediaPaneMenu({ mediaAsset, ...props }) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  return isLoggedIn && (
    <>
      <IconButton
        {...props}
        aria-label={t('ariaLabel')}
        onClick={handleClick}
        aria-controls={open ? 'media-pane-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={{
          color: 'var(--yarl__color_button, hsla(0,0%,100%,.8))'
        }}
        className='yarl__button'
      >
        <MoreVert sx={{ fontSize: '1.75rem' }} />
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