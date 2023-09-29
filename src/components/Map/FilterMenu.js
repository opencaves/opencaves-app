import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Scrollbars from 'react-custom-scrollbars-2'
import { Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, SwipeableDrawer, Switch, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useTheme } from '@mui/material/styles'
import { Close } from '@mui/icons-material'
import { toggleFilterMenu, setResultPaneSmOpen } from '@/redux/slices/appSlice'
import { setShowValidCoordinates, setShowInvalidCoordinates, setShowUnconfirmedCoordinates, setShowAccesses, setShowAccessibilities } from '@/redux/slices/searchSlice'
import { useSmall } from '@/hooks/useSmall'
import './FilterMenu.scss'

function FilterMenuHead({ title, children, ...props }) {

  const dispatch = useDispatch()
  const filterMenuOpen = useSelector(state => state.app.filterMenuOpen)

  function onFilterMenuCloseBtnClick() {
    dispatch(toggleFilterMenu(!filterMenuOpen))
  }

  return (
    <Box>
      <Grid
        container
        alignItems='center'
        gap={1}
        sx={{
          boxShadow: 'var(--md-shadows-2)',
          position: 'relative',
          zIndex: '1',
          py: 1.5,
          px: 1
        }}
        {...props}
      >
        <Grid>
          <IconButton
            onClick={onFilterMenuCloseBtnClick}
          >
            <Close />
          </IconButton>
        </Grid>
        <Grid xs>
          <Typography
            component='h2'
            sx={{
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '0.0125em'
            }}
          >{title}</Typography>
        </Grid>
      </Grid>
    </Box>
  )
}

function FilterMenuContent({ children, ...props }) {

  const theme = useTheme()

  return (
    <Grid
      {...props}
      flex={1}
      overflow='hidden'
      xs
    >
      <Scrollbars
        autoHide
        renderThumbVertical={({ style, ...props }) =>
          <div
            {...props}
            style={{
              ...style,
              cursor: 'pointer',
              borderRadius: 'inherit',
              backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)'
            }}
          />
        }
      >
        {children}
      </Scrollbars>
    </Grid>
  )
}

function FilterMenuSectionHeader({ children, ...props }) {

  return (
    <Box
      display='flex'
      alignItems='end'
      sx={{
        minHeight: '48px',
      }}
    >
      <Typography
        component='h3'
        sx={{
          lineHeight: 1,
          color: 'var(--md-palette-text-secondary)',
          fontWeight: 500,
          fontSize: '0.875rem',
          px: '1rem',
          bgcolor: 'var(--md-palette-background-paper)'
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

function FilterMenuItem({ primary, secondary, nb, checked, onClick }) {

  return (
    <ListItem
      disablePadding
    >
      <ListItemButton
        onClick={onClick}
        divider
      >
        <ListItemText
          primary={
            <>
              {primary}
              <Typography variant='mapTextSmall' sx={theme => ({ ml: theme.spacing(1) })}>{nb}</Typography>
            </>
          }
          secondary={secondary && (
            <Typography variant='mapTextSecondary'>{secondary}</Typography>
          )}
        />
        <ListItemIcon>
          <Switch
            edge='end'
            disableRipple={true}
            checked={checked}
            onChange={() => { }}
            sx={{
              userSelect: 'none',
              '& > .MuiSwitch-switchBase:hover': {
                bgcolor: 'transparent'
              },
              '& > .MuiSwitch-switchBase.Mui-checked:hover': {
                bgcolor: 'transparent'
              }
            }}
          />
        </ListItemIcon>
      </ListItemButton>
    </ListItem>
  )
}

export default function MapFilterMenu({ props }) {

  const filterMenuOpen = useSelector(state => state.app.filterMenuOpen)

  const showValidCoordinates = useSelector(state => state.search.showValidCoordinates)
  const showInvalidCoordinates = useSelector(state => state.search.showInvalidCoordinates)
  const showUnconfirmedCoordinates = useSelector(state => state.search.showUnconfirmedCoordinates)
  const showAccesses = useSelector(state => state.search.showAccesses)
  const showAccessibilities = useSelector(state => state.search.showAccessibilities)

  const dataStats = useSelector(state => state.map.dataStats)

  const dispatch = useDispatch()
  const { t } = useTranslation('filter')

  const handleShowValidCoordinates = () => {
    dispatch(setShowValidCoordinates(!showValidCoordinates))
  }

  const handleShowInvalidCoordinates = () => {
    dispatch(setShowInvalidCoordinates(!showInvalidCoordinates))
  }

  const handleShowUnconfirmedCoordinates = () => {
    dispatch(setShowUnconfirmedCoordinates(!showUnconfirmedCoordinates))
  }

  function handleToggleFilterMenu(open) {
    // console.log('[handleToggleFilterMenu] %o', open)
    return function doToggleFilterMenu(event) {
      if (
        event &&
        event.type === 'keydown' &&
        (event.key === 'Tab' || event.key === 'Shift')
      ) {
        return
      }

      toggleFilterMenu(open)
      dispatch(setResultPaneSmOpen(open))
    }
  }

  function handleShowAccesses(checked, accessKey) {
    const newAccesses = showAccesses.map(access => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })
    dispatch(setShowAccesses(newAccesses))
  }

  function handleShowAccessibilities(checked, accessKey) {
    const newAccessibilities = showAccessibilities.map(access => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })

    dispatch(setShowAccessibilities(newAccessibilities))
  }

  function getDataStat(prop, value) {
    return dataStats?.[prop]?.[value] || 0
  }

  const accessibilities = t('accessibility.items', { returnObjects: true })
  const accesses = t('access.items', { returnObjects: true })
  const isSmall = useSmall()

  return (
    <SwipeableDrawer
      {...props}
      anchor='right'
      hideBackdrop={true}
      variant='persistent'
      PaperProps={{
        square: false,
        sx: {
          borderRadius: isSmall ? 'none' : '0.5rem 0 0 0.5rem',
          top: 'var(--oc-filter-menu-top)'
        }
      }}
      sx={{
        '& > .MuiDrawer-paper': {
          width: 'var(--oc-filter-menu-width)',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden'
        }
      }}
      open={filterMenuOpen}
      onOpen={handleToggleFilterMenu(true)}
      onClose={handleToggleFilterMenu(false)}
    >
      <FilterMenuHead
        title={t('windowTitle')}
      />

      <FilterMenuContent>

        <FilterMenuSectionHeader>{t('coordinate.heading')}</FilterMenuSectionHeader>

        <List disablePadding>
          <FilterMenuItem
            primary={t('coordinate.showValidCoordinates')}
            nb={getDataStat('location.validity', 'valid')}
            onClick={handleShowValidCoordinates}
            checked={showValidCoordinates}
          />
          <FilterMenuItem
            primary={t('coordinate.showInvalidCoordinates')}
            nb={getDataStat('location.validity', 'invalid')}
            onClick={handleShowInvalidCoordinates}
            checked={showInvalidCoordinates}
          />
          <FilterMenuItem
            primary={t('coordinate.showUnconfirmedCoordinates')}
            nb={getDataStat('location.validity', 'unknown')}
            onClick={handleShowUnconfirmedCoordinates}
            checked={showUnconfirmedCoordinates}
          />
        </List>

        <FilterMenuSectionHeader>{t('access.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          {
            showAccesses.map(({ key, checked }, index) => {
              const primary = accesses.find(a => a.key === key).label
              const secondary = accesses.find(a => a.key === key).description
              const nb = getDataStat('access', key)
              const onClick = (e) => handleShowAccesses(!checked, key)
              const k = `access.${key}.${index}`

              return (
                <FilterMenuItem
                  key={k}
                  primary={primary}
                  secondary={secondary}
                  nb={nb}
                  checked={checked}
                  onClick={onClick}
                />
              )
            })
          }
        </List>

        <FilterMenuSectionHeader>{t('accessibility.heading')}</FilterMenuSectionHeader>
        <List disablePadding>
          {
            showAccessibilities.map(({ key, checked }, index) => {
              const primary = accessibilities.find(a => a.key === key).label
              const secondary = accessibilities.find(a => a.key === key).description
              const nb = getDataStat('accessibility', key)
              const onClick = (e) => handleShowAccessibilities(e.target.checked, key)
              const k = `accessibility.${key}.${index}`

              return (
                <FilterMenuItem
                  key={k}
                  primary={primary}
                  secondary={secondary}
                  nb={nb}
                  checked={checked}
                  onClick={onClick}
                />
              )
            })
          }
        </List>
      </FilterMenuContent>
    </SwipeableDrawer>
  )
}