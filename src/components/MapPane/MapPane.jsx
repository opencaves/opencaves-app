import { useEffect } from 'react'
import { Link, useLoaderData, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Typography, styled, useTheme } from '@mui/material'
import { ArrowBackRounded, ArrowForwardRounded, DescriptionRounded, MapOutlined } from '@mui/icons-material'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
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

export async function mapPaneLoader({ params }) {
  const cave = await CaveModel.getById(params.caveId)
  const sistema = cave?.sistemaId ? await SistemaModel.getById(cave.sistemaId) : null
  const mapIds = Array.isArray(sistema?.maps) ? sistema.maps : []
  const maps = (await Promise.all(mapIds.map((id) => mapsModel.getById(id)))).filter(Boolean)
  return { sistemaId: cave?.sistemaId || null, maps }
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
  const [mapFiles] = mapsModel.useAll()
  const sistemaId = initial.sistemaId
  const liveSistema = sistemas.find((s) => s.id === sistemaId)
  const mapIds = liveSistema ? (Array.isArray(liveSistema.maps) ? liveSistema.maps : []) : initial.maps.map((m) => m.id)
  const maps = mapIds.map((id) => mapFiles.find((m) => m.id === id) || initial.maps.find((m) => m.id === id)).filter(Boolean)

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

  const list = (
    <List disablePadding>
      {maps.map((map) => (
        <ListItemButton key={map.id} component={Link} to={`../maps/${map.id}`} state={location.state} relative="path" selected={map.id === mapId}>
          <ListItemIcon sx={{ minWidth: 40 }}>{map.contentType === 'application/pdf' && !map.previewUrl ? <DescriptionRounded /> : <MapOutlined />}</ListItemIcon>
          <ListItemText primary={map.name} primaryTypographyProps={{ noWrap: true }} />
        </ListItemButton>
      ))}
    </List>
  )

  return isSmall ? (
    <Box className="oc-map-pane" sx={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {mapId && maps.length > 0 && <MapPaneDetails mapId={mapId} maps={maps} sistemaId={sistemaId} returnTo={returnTo} />}
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
            {tEdit('maps')}{currentCave ? ` – ${currentCave.name.value}` : ''}
          </Typography>
        </DrawerHeader>
        <Box sx={{ mt: 'var(--oc-pane-padding-block)', height: '100%', overflowY: 'auto' }}>{list}</Box>
      </Drawer>
      {mapId && maps.length > 0 && <MapPaneDetails mapId={mapId} maps={maps} sistemaId={sistemaId} returnTo={returnTo} />}
    </Box>
  )
}
