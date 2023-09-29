import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppBar as MUIAppBar, Box, IconButton, Toolbar, Typography, Divider, List, ListItem, ListItemButton, ListItemText, Button, Drawer, styled, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { MenuRounded } from '@mui/icons-material'
import { useSmall } from '@/hooks/useSmall'
import LogoIcon from './LogoIcon'
import { appName, appTitle } from '@/config/app'

const drawerWidth = 240
const navItems = [
  { key: 'home', to: '/' },
  { key: 'about', to: '/about' },
  // { key: 'contact', to: '/contact' }
]

export default function AppBar(props) {
  const { window } = props
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const theme = useTheme()
  const isSmall = useSmall(theme.breakpoints.down('md'))
  console.log('theme: %o', theme)

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState)
  }

  const StyledButton = styled(Button)({
    color: 'var(--md-palette-primary-contrastText)',
    whiteSpace: 'nowrap',
    borderColor: 'rgba(255 255 255 / 0.5)',
    ':hover': {
      borderColor: '#fff'
    }
  })

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant='h6' sx={{ my: 2 }} noWrap>
        {appTitle}
      </Typography>
      <Divider />
      <List>
        {navItems.map(({ key, to }) => (
          <ListItem key={key} disablePadding>
            <ListItemButton component={Link} to={to} sx={{ textAlign: 'center' }}>
              <ListItemText primary={t(`${key}`, { name: appName })} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  const container = window !== undefined ? () => window().document.body : undefined

  return (
    <>
      <MUIAppBar component='nav'>
        <Toolbar>
          {
            isSmall && (
              <IconButton
                color='inherit'
                aria-label={t('drawer.ariaLabel')}
                edge='start'
                onClick={handleDrawerToggle}
                sx={{ mr: { xs: 1, sm: 2 } }}
              >
                <MenuRounded />
              </IconButton>
            )
          }

          <Link
            to='/'
          >
            <LogoIcon colorScheme='dark' sx={{ mr: 1 }} />
          </Link>

          <StyledButton
            variant='text'
            component={Link}
            to='/'
            sx={{
              mr: 2,
              p: 0
            }}
          >
            <Typography
              variant='h6'
              noWrap
              sx={{
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              {appTitle}
            </Typography>
          </StyledButton>

          <Grid
            container
            xs
            flexWrap='nowrap'
          >
            {!isSmall && (
              <Grid
                sx={{ mr: 1 }}
              >
                {navItems.map(({ key, to }) => (
                  <Button key={key} component={Link} to={to} sx={{ color: '#fff' }}>
                    {t(`${key}`, { name: appName })}
                  </Button>
                ))}
              </Grid>
            )}
            <Grid
              container
              flexWrap='nowrap'
              sx={{
                flexGrow: 1,
                justifyContent: 'flex-end'
              }}>
              <StyledButton
                variant='text'
                component={Link}
                to='/login'
              >
                {t('login')}
              </StyledButton>
              <StyledButton
                variant='outlined'
                component={Link}
                to='/signup'
              >
                {t('signup')}
              </StyledButton>
            </Grid>
          </Grid>

        </Toolbar>
      </MUIAppBar>
      {
        isSmall && (
          <nav>
            <Drawer
              container={container}
              variant='temporary'
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: isSmall, // Better open performance on mobile.
              }}
              sx={{
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
              }}
            >
              {drawer}
            </Drawer>
          </nav>
        )
      }
      <Toolbar />
    </>
  )
}