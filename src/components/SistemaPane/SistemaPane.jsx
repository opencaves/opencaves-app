import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Collapse, Drawer, Fab, IconButton, List, ListItem, ListItemButton, ListItemText, TextField, Typography, styled, useTheme } from '@mui/material'
import { AddRounded, ArrowBackRounded, ArrowForwardRounded, EditRounded, SearchRounded } from '@mui/icons-material'
import pushId from 'unique-push-id'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { useSmall } from '@/hooks/useSmall.jsx'
import { paneWidth as baseWidth } from '@/config/app.js'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'

const areasModel = createCollectionModel('areas')

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  ...theme.mixins.toolbar
}))

export default function SistemaPane() {
  const theme = useTheme()
  const navigate = useNavigate()
  const isSmall = useSmall()
  // Matches the edit-mode details pane's own width (ResultPaneLg.jsx),
  // since this pane is only reachable from there.
  const paneWidth = isSmall ? '100vw' : `min(${baseWidth * 2}px, 80vw)`
  const { t } = useTranslation('sistemaPane')
  const [sistemas, loading] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const areasById = new Map(areas.map((a) => [a.id, a.name]))
  // Starts closed and flips open right after mount, so the Drawer always
  // sees a real false -> true transition and plays its slide-in animation
  // (anchor="left" slides in left-to-right). Navigating back sets it closed
  // first and waits for the matching slide-out (right-to-left) to finish
  // before actually leaving the route, instead of unmounting instantly.
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef(null)

  useEffect(() => {
    document.title = t('header')
  }, [t])

  useEffect(() => {
    setOpen(true)
  }, [])

  function handleBack() {
    setOpen(false)
  }

  function toggleSearch() {
    setSearchOpen((wasOpen) => {
      const nowOpen = !wasOpen
      if (nowOpen) {
        requestAnimationFrame(() => searchInputRef.current?.focus())
      } else {
        setSearch('')
      }
      return nowOpen
    })
  }

  const q = search.trim().toLowerCase()
  const visibleSistemas = [...sistemas]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .filter((sistema) => {
      if (!q) {
        return true
      }
      const areaName = areasById.get(sistema.area) || ''
      const aka = sistema.aka || []
      return (sistema.name || '').toLowerCase().includes(q) || areaName.toLowerCase().includes(q) || aka.some((a) => a.toLowerCase().includes(q))
    })

  return (
    <Box
      className="oc-sistema-pane"
      sx={{
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Drawer
        className="oc-sistema-pane--drawer"
        sx={{
          width: paneWidth,
          flexShrink: 0,
          '& > .MuiDrawer-paper': {
            width: paneWidth,
            boxSizing: 'border-box',
            border: 0,
            overflow: 'hidden',
            position: 'relative',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
        transitionDuration={{ enter: theme.oc.sys.motion.duration.emphasizedDecelerate, exit: theme.oc.sys.motion.duration.emphasizedAccelerate }}
        slotProps={{
          transition: {
            easing: { enter: theme.sys.motion.easing.emphasizedDecelerate, exit: theme.sys.motion.easing.emphasizedAccelerate },
            onExited: () => navigate(-1),
          },
        }}
      >
        <DrawerHeader className="oc-sistema-pane--header">
          <IconButton
            aria-label={t('backBtn.ariaLabel')}
            onClick={handleBack}
            disableRipple
          >
            {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardRounded />}
          </IconButton>

          <Typography
            variant="fontTitleLarge"
            sx={{
              flexGrow: 1,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t('header')}
          </Typography>

          <IconButton
            aria-label={t('searchBtn.ariaLabel')}
            onClick={toggleSearch}
          >
            <SearchRounded />
          </IconButton>
        </DrawerHeader>

        <Collapse in={searchOpen}>
          <Box sx={{ px: 'var(--oc-pane-padding-inline)', pt: 'var(--oc-pane-padding-block)' }}>
            <TextField
              inputRef={searchInputRef}
              size="small"
              fullWidth
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>
        </Collapse>

        <Box
          className="oc-sistema-pane--content"
          sx={{
            p: 'var(--oc-pane-padding-inline)',
            mt: 'var(--oc-pane-padding-block)',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {loading ? (
            <Typography>{t('loading')}</Typography>
          ) : (
            <List disablePadding>
              {visibleSistemas.map((sistema) => {
                const areaName = areasById.get(sistema.area)
                const aka = sistema.aka || []
                return (
                  <ListItem
                    key={sistema.id}
                    divider
                    disablePadding
                    secondaryAction={
                      <IconButton edge="end" component={Link} to={`${sistema.id}/edit`} aria-label={t('editSistemaBtn.ariaLabel')}>
                        <EditRounded fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemButton onClick={() => navigate(`${sistema.id}/edit`)} sx={{ pr: 6 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: 0.5, bgcolor: sistema.color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', mr: 1, flexShrink: 0 }} />
                            {sistema.name || t('unnamedSistema')}
                            {areaName && (
                              <Typography component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>
                                ({areaName})
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={[sistema.id, aka.length ? `${t('akaLabel')}: ${aka.join(', ')}` : null].filter(Boolean).join(' · ')}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          )}
        </Box>

        <Fab
          className="oc-sistema-pane--new-fab"
          color="primary"
          aria-label={t('newSistema')}
          component={Link}
          to={`${pushId()}/edit`}
          sx={{ position: 'absolute', bottom: theme.spacing(2), right: theme.spacing(2) }}
        >
          <AddRounded />
        </Fab>
      </Drawer>
      <Outlet />
    </Box>
  )
}
