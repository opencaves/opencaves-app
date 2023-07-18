
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, ListItem, Menu, MenuItem, Divider, SvgIcon } from '@mui/material'
import { toggleAboutDialog } from '../../redux/slices/appSlice'
import { ReactComponent as AppLogo } from '../../images/logo/logo-light.svg'
import { ReactComponent as AppLogoDark } from '../../images/logo/logo-dark.svg'
import { useTheme } from '@emotion/react'


export default function AppMenu({ component: Component = IconButton, ...props }) {
  console.log('component: %o', Component)
  const dispatch = useDispatch()
  const theme = useTheme()
  const { t } = useTranslation('app')
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
    dispatch(toggleAboutDialog())
  }

  function onAboutMenuClick() {
    setAnchorEl(null)
  }

  return (
    <>
      <Component
        {...props}
        aria-label={t('menu.ariaLabel')}
        onClick={handleClick}
        aria-controls={open ? 'app-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        {
          theme.palette.mode === 'light' ? (
            <SvgIcon component={AppLogo} inheritViewBox />
          ) : (
            <SvgIcon component={AppLogoDark} inheritViewBox />
          )
        }
      </Component>
      <Menu
        anchorEl={anchorEl}
        id="app-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* <MenuItem onClick={handleClose}>
          <Avatar /> Profile
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Avatar /> My account
        </MenuItem>
        <Divider /> */}
        {/* <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <PersonAdd fontSize="small" />
          </ListItemIcon>
          Add another account
        </MenuItem> */}

        {/* <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem> */}

        {/* <Divider />
        <MenuItem onClick={handleClose}>
          <ListItem>
            About
          </ListItem>
        </MenuItem> */}
        <MenuItem onClick={onAboutMenuClick}>
          {t('menu.about')}
        </MenuItem>
      </Menu>
    </>
  )
}