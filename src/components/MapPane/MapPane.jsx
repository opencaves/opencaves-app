import { useEffect, useState } from 'react'
import { Link, Outlet, useLoaderData, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Drawer, IconButton, List, ListItemButton, ListSubheader, Typography, styled, useTheme } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import MapPaneDetails from './MapPaneDetails.jsx'
import usePaneWidth from '@/hooks/usePaneWidth.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'

const mapsModel = createCollectionModel('maps')

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  ...theme.mixins.toolbar,
}))

// The list's thumbnail: 4:3, the shape of most survey sheets.
const THUMBNAIL_WIDTH = 88
const THUMBNAIL_HEIGHT = 66

function MapThumbnail({ map }) {
  const [failed, setFailed] = useState(false)
  // thumbnailUrl/previewUrl: the light WebP derivatives the onMap*Uploaded functions make.
  const src = map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') && map.url)
  return (
    <Box className="oc-map-pane--thumbnail" sx={{ flexShrink: 0, width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
      {src && !failed ? (
        <Box component="img" src={src} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : map.contentType === 'application/pdf' ? (
        <PictureAsPdfRounded color="action" />
      ) : (
        <MapOutlined color="action" />
      )}
    </Box>
  )
}

// One map: its thumbnail, its name (two lines at most) and, under it, its
// date and authors - enough to tell apart maps that share a name.
function MapListItem({ map, caveId, selected, state }) {
  const details = [map.date, map.authors?.join(', ')].filter(Boolean).join(' · ')
  return (
    <ListItemButton
      className="oc-map-pane--item"
      component={Link}
      // Absolute: a relative "../maps/<id>" resolved one level too deep (…/maps/maps/<id>).
      to={`/map/${caveId}/maps/${map.id}`}
      state={state}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      sx={{
        gap: 2,
        alignItems: 'center',
        mx: 1,
        px: 1,
        py: 1,
        borderRadius: 3,
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: (theme) => `rgb(${theme.vars.palette.primary.mainChannel} / 0.12)` },
      }}
    >
      <MapThumbnail map={map} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: selected ? 500 : 400 }}>
          {map.name}
        </Typography>
        {details && (
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {details}
          </Typography>
        )}
      </Box>
    </ListItemButton>
  )
}

export async function mapPaneLoader({ params }) {
  const cave = await CaveModel.getById(params.caveId)
  const sistemaId = cave?.sistemaId || null
  const [sistemas, connections] = sistemaId ? await Promise.all([SistemaModel.getAll(), ConnectionModel.getAll()]) : [[], []]
  const mapRefs = getSistemaMapRefs(sistemaId, sistemas, connections)
  const maps = (await Promise.all(mapRefs.map(({ id }) => mapsModel.getById(id)))).filter(Boolean)
  return { sistemaId, mapRefs, maps }
}

// Clicking a map opens this - the same drawer + big-viewer structure as
// Pictures' MediaPane.jsx, reusing that established pattern instead of a
// one-off lightbox, since maps benefit from the same "browse while viewing"
// shape pictures already have.
export default function MapPane() {
  const { t } = useTranslation('mediaPane')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const isSmall = useSmall()
  const theme = useTheme()
  const paneWidth = usePaneWidth()
  const { caveId, mapId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const currentCave = useSelector((state) => state.map.currentCave)
  const initial = useLoaderData()
  const returnTo = location.state?.from || `/map/${caveId}`
  const [sistemas] = SistemaModel.useAll()
  const [connections, connectionsLoading] = ConnectionModel.useAll()
  const [mapFiles] = mapsModel.useAll()
  const sistemaId = initial.sistemaId
  // Falls back to the loader's snapshot until the live listeners have data.
  const live = sistemas.length > 0 && !connectionsLoading
  const mapRefs = live ? getSistemaMapRefs(sistemaId, sistemas, connections) : initial.mapRefs
  const maps = mapRefs
    .map(({ id, sistemaId: ownerId }) => {
      const map = mapFiles.find((m) => m.id === id) || initial.maps.find((m) => m.id === id)
      return map && { ...map, sistemaId: ownerId }
    })
    .filter(Boolean)

  useEffect(() => {
    if (maps.length === 0) {
      navigate(returnTo, { replace: true })
      return
    }
    if (!mapId) {
      navigate(maps[0].id, { replace: true, state: location.state })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, maps.length])

  // Maps come from the cave's sistema and the sistemas it belongs to: when
  // there's more than one, each group gets its sistema's name.
  const groups = []
  for (const map of maps) {
    const group = groups.find((g) => g.sistemaId === map.sistemaId)
    if (group) group.maps.push(map)
    else groups.push({ sistemaId: map.sistemaId, maps: [map] })
  }
  const sistemaName = (id) => sistemas.find((s) => s.id === id)?.name
  const list = (
    <List className="oc-map-pane--list" disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 2 }}>
      {groups.map((group) => [
        groups.length > 1 && sistemaName(group.sistemaId) && (
          <ListSubheader key={`${group.sistemaId}-header`} disableSticky sx={{ lineHeight: 1.5, pt: 2, pb: 0.5, px: 3, typography: 'subtitle2', color: 'text.secondary', bgcolor: 'transparent' }}>
            {`${tEdit('sistema')} ${sistemaName(group.sistemaId)}`}
          </ListSubheader>
        ),
        ...group.maps.map((map) => <MapListItem key={map.id} map={map} caveId={caveId} selected={map.id === mapId} state={location.state} />),
      ])}
    </List>
  )

  return isSmall ? (
    <Box className="oc-map-pane" sx={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {mapId && maps.length > 0 && <MapPaneDetails mapId={mapId} maps={maps} sistemaId={sistemaId} returnTo={returnTo} />}
      {/* /edit: the map's Edit dialog (routes/map/maps/MapEdit.jsx). */}
      <Outlet context={{ maps }} />
    </Box>
  ) : (
    <Box className="oc-map-pane" sx={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Drawer
        className="oc-map-pane--drawer"
        sx={{
          width: paneWidth,
          flexShrink: 0,
          '& > .MuiDrawer-paper': { width: paneWidth, boxSizing: 'border-box', border: 0, overflow: 'hidden' },
        }}
        variant="persistent"
        anchor="left"
        open={true}
      >
        <DrawerHeader className="oc-map-pane--header">
          <IconButton aria-label={t('backBtn.ariaLabel')} component={Link} to={returnTo} disableRipple>
            {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardRounded />}
          </IconButton>
          <Typography variant="fontTitleLarge" sx={{ flexGrow: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tEdit('maps')}{currentCave ? ` – ${currentCave.name?.value || t('caveNameUnknown', { ns: 'map' })}` : ''}
          </Typography>
          {/* As wide as the back button, so the title centres on the pane, not beside the button. */}
          <Box aria-hidden sx={{ width: 40, flexShrink: 0 }} />
        </DrawerHeader>
        <Box sx={{ mt: 'var(--oc-pane-padding-block)', height: '100%', overflowY: 'auto' }}>{list}</Box>
      </Drawer>
      {mapId && maps.length > 0 && <MapPaneDetails mapId={mapId} maps={maps} sistemaId={sistemaId} returnTo={returnTo} />}
      {/* /edit: the map's Edit dialog (routes/map/maps/MapEdit.jsx). */}
      <Outlet context={{ maps }} />
    </Box>
  )
}
