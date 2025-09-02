
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useMatches } from 'react-router-dom'
import { Button, Menu, Divider, Avatar, ListItemIcon, useTheme, Typography, Tooltip, Box } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { PersonRounded } from '@mui/icons-material'
import MenuItem from './MenuItem'
import SignupMenuItem from './menu/SignupMenuItem'
import LogInMenuItem from './menu/LogInMenuItem'
import LogoutMenuItem from './menu/LogoutMenuItem'
import AddMedias from './menu/AddMediasMenuItem'
import LogoIcon from './LogoIcon'
import { useSmall } from '@/hooks/useSmall'
import useSession from '@/hooks/useSession'
import { setContinueUrl } from '@/redux/slices/sessionSlice'
import { appName } from '@/config/app'


export default function AppMenu({ sx, ...props }) {
  const dispatch = useDispatch()
  const hasSession = useSession()
  const user = useSelector(state => state.session.user)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const isSmall = useSmall()
  const theme = useTheme()
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const location = useLocation()
  const [routeId, setRouteId] = useState()
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  const matches = useMatches()

  const menuStyles = {
    minWidth: 'unset',
    borderRadius: '50%',
    bgcolor: !isSmall && !isLoggedIn && theme.palette.background.paper,
    ':hover': {
      bgcolor: !isSmall && !isLoggedIn && theme.palette.background.paper
    }
  }

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  function onSignupBtnClick() {
    dispatch(setContinueUrl(`${location.pathname}${location.search}${location.hash}`))
  }

  useEffect(() => {
    setRouteId(matches[matches.length - 1].id)
  }, [matches])

  return (
    <>
      <Tooltip title={t('tooltip')}>
        <Button
          {...props}
          variant={isSmall ? 'text' : 'contained'}
          aria-label={t('ariaLabel')}
          onClick={handleClick}
          aria-controls={open ? 'app-menu' : undefined}
          aria-haspopup='true'
          aria-expanded={open ? 'true' : undefined}
          sx={{
            ...sx,
            ...menuStyles
          }}
        >
          {
            isLoggedIn ? (
              <Avatar
                src={user.photoURL || 'broken-image.webp'}
                alt={user.displayName}
                sx={{
                  bgcolor: 'transparent',
                  // color: 'inherit',
                  width: '32px',
                  height: '32px',
                  outline: isSmall ? null : `3px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2
                }}
              />
            ) : (
              <LogoIcon />
            )
          }
        </Button>
      </Tooltip>
      <Menu
        id='app-menu'
        component='nav'
        anchorEl={anchorEl}
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
          isLoggedIn && [
            <Box key='key-user-info' px={2} py={0.75}>
              <Grid
                container
                direction='column'
                alignItems='center'
                gap={1}
                // my={2}
                p={1}
              >
                <Avatar
                  src={user.photoURL || 'broken-image.webp'}
                  alt={user.displayName}
                  sx={{
                    bgcolor: theme.palette.primary.main,
                    boxShadow: '0 0 0 1px rgba(31, 35, 40, 0.15)'
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 'var(--md-sys-typescale-label-large-size)'
                  }}
                >
                  {user.displayName}
                </Typography>
              </Grid>
            </Box>,
            <MenuItem key='key-signup' component={Link} to='/account' onClick={handleClose}>
              <ListItemIcon>
                <PersonRounded fontSize='small' />
              </ListItemIcon>
              {t('myAccount')}
            </MenuItem>,
            <Divider key='key-divider-1' />
          ]
        }

        {
          !isLoggedIn && [
            <LogInMenuItem key='key-login' />,
            <SignupMenuItem key='key-signup' />,
            <Divider key='key-divider-2' />
          ]
        }

        {
          isLoggedIn && routeId === 'result-pane' && (
            <AddMedias />
          )
        }

        <MenuItem key='key-about2' component={Link} to='/about' state={{ backgroundLocation: location }}>
          {t('about', { context: 'withName', name: appName })}
        </MenuItem>

        {
          isLoggedIn && [
            <Divider key='key-divider-3' />,
            <LogoutMenuItem key='key-logout' />
          ]
        }
      </Menu>
    </>
  )
}