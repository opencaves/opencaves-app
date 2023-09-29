
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { IconButton, Menu, Divider, ListItemIcon } from '@mui/material'
import { MoreVert, PersonRounded } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem'
import AddMedias from '@/components/App/menu/AddMediasMenuItem'
import { appName } from '@/config/app'

export default function ResultPaneMenu({ ...props }) {
  const user = useSelector(state => state.session.user)
  const { t } = useTranslation('resultPane', { keyPrefix: 'menu' })
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

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
        aria-controls={open ? 'result-pane-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id='result-pane-menu'
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
        {
          user && (
            <MenuItem>
              <ListItemIcon>
                <PersonRounded fontSize='small' />
              </ListItemIcon>
              {t('myAccount')}
            </MenuItem>
          )
        }
        {
          user && (
            <Divider sx={{ my: 0.5 }} />
          )
        }

        {/* <MenuItem>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>*/}
        <MenuItem disabled>
          {t('edit')}
        </MenuItem>

        <AddMedias />

        <MenuItem component={Link} to='/about'>
          {t('about', { name: appName })}
        </MenuItem>
      </Menu>
    </>
  )
}