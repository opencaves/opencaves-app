
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, ListItem, Menu, MenuItem, Divider, SvgIcon } from '@mui/material'
import { toggleAboutDialog } from '../../redux/slices/appSlice'
import { ReactComponent as AppLogo } from '../../images/logo/logo-light.svg'
import { ReactComponent as AppLogoDark } from '../../images/logo/logo-dark.svg'
import { useTheme } from '@emotion/react'


export default function AppMenu({ component: Component = IconButton, ...props }) {
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
        <MenuItem
          sx={{
            fontSize: 'var(--md-sys-typescale-label-large-size)',
            fontWeight: 'var(--md-sys-typescale-label-large-weight)',
            lineHeight: 'var(--md-sys-typescale-label-large-height)',
            color: 'var(--md-sys-color-onSurface)',
            px: 1.5
          }}
          onClick={onAboutMenuClick}
        >
          {t('menu.about')}
        </MenuItem>
      </Menu>
    </>
  )
}