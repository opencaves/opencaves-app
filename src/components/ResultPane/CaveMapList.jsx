import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import MapRounded from '@mui/icons-material/MapRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import { Box, Button, ButtonBase, Typography } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import { centerFocused, leaveOnArrow, scrollStrip, snapOnSettle } from '@/utils/mediaStrip.js'
import mapsModel from '@/models/MapModel.js'
import { isTrashed } from '@/utils/trash.js'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { compareMapsByDate, getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import AddMapButton from '@/components/MapsPicker/AddMapButton.jsx'
import { useCanTrashMaps, useTrashMapConfirm } from '@/components/MapPane/TrashMap.jsx'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useOnline } from '@/hooks/useOnline.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'

// The title bar over a map's thumbnail: a caption line and its padding. The
// options menu sits on it, as tall as it and centred.
const TITLE_BAR_PY = 0.5
const TITLE_BAR_HEIGHT = 'calc(0.75rem * 1.66 + 8px)'
const TITLE_BAR_MENU_SX = { top: 0, right: 4, height: TITLE_BAR_HEIGHT, width: TITLE_BAR_HEIGHT, p: 0 }

function MapPreview({ caveId, map, index, returnTo, mapPath, menu = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tMaps } = useTranslation('mapsPicker')
  const [failed, setFailed] = useState(false)
  // Failed offline (not on the device): says so, and tries again online.
  const [failedOffline, setFailedOffline] = useState(false)
  const online = useOnline()
  const { t: tOffline } = useTranslation('offline')
  useEffect(() => {
    if (online && failedOffline) {
      setFailed(false)
      setFailedOffline(false)
    }
  }, [online, failedOffline])
  const { file } = map
  // thumbnailUrl/previewUrl: WebP (or SVG) derivatives made by the
  // onMap*Uploaded functions, much lighter than the original upload.
  const url = file?.thumbnailUrl || file?.previewUrl || map.url
  const image = (file?.thumbnailUrl || file?.previewUrl || file?.contentType?.startsWith('image/')) && !failed
  const content = (
    <>
      {image ? <Box component="img" src={url} alt="" loading="lazy" crossOrigin="anonymous" draggable={false} onError={() => { setFailed(true); setFailedOffline(!navigator.onLine) }} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Box sx={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', bgcolor: 'action.hover' }}>{failedOffline ? <CloudOffRounded role="img" aria-label={tOffline('notOnDevice')} titleAccess={tOffline('notOnDevice')} sx={{ color: 'text.secondary' }} /> : file?.contentType === 'application/pdf' ? <PictureAsPdfRounded color="primary" fontSize="large" /> : <MapRounded color="primary" fontSize="large" />}</Box>}
      <Typography
        variant="caption"
        noWrap
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          px: 1,
          py: TITLE_BAR_PY,
          // Room at the right for the options menu, when it's there.
          pr: menu ? 5 : 1,
          color: 'common.white',
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          // Over the thumbnail's outline: along the title, the edge is its colour.
          zIndex: 1,
          // Its date after its name, whole: only the name is cut short.
          display: 'flex',
          gap: 0.75,
        }}
      >
        <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file?.name || t('openMap')}
        </Box>
        {file?.date && (
          <Box component="span" className="oc-cave-map-list--date" sx={{ flex: 'none', color: 'rgba(255, 255, 255, 0.75)' }}>
            {file.date}
          </Box>
        )}
      </Typography>
      {/* Who drew it, along the bottom edge as the title along the top. */}
      {file?.authors?.length > 0 && (
        <Typography variant="caption" noWrap className="oc-cave-map-list--cartography" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1, py: TITLE_BAR_PY, color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.6)', zIndex: 1 }}>
          {tMaps('cartography', { names: file.authors.join(', ') })}
        </Typography>
      )}
    </>
  )

  return (
    <ButtonBase component={Link} to={mapPath ? mapPath(map.value) : `/map/${caveId}/maps/${map.value}`} state={mapPath ? { fromPage: true } : { from: returnTo }} aria-label={t('openMapNumber', { index })} sx={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      {content}
    </ButtonBase>
  )
}

/**
 * Maps belong to a sistema (shared by every cave in it), not to an individual
 * cave - this tab is a view onto `sistemaId`'s sistema.maps plus its ancestor
 * sistemas' maps, read and written directly (not staged in the cave's own
 * edit form) since it isn't this cave's own data. New maps are added to the
 * cave's own sistema; inherited ones can only be removed from their own
 * sistema, since removing them here would affect every sibling cave.
 *
 * @param {object} props
 * @param {(id: string) => string} [props.mapPath] - A map's address (a page's gallery); the map's viewer otherwise.
 */
export default function CaveMapList({ caveId, sistemaId, canAdd = true, onAddUnauthorized, returnTo, mapPath }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tMaps } = useTranslation('mapsPicker')
  const [sistemas] = SistemaModel.useAll()
  const [connections] = ConnectionModel.useAll()
  // With the maps in the trash, to leave out the sistema's references to them
  // (kept, so a restored map comes back), not show them as unknown files.
  const [mapFiles] = mapsModel.useAll({ includeTrashed: true })
  const scrollbarsRef = useRef()
  const navigate = useNavigate()

  // Admins: deleting the map itself (to the trash), not only from this sistema.
  const canTrash = useCanTrashMaps()
  const { requestTrash, dialog: trashDialog } = useTrashMapConfirm()
  const selectedMaps = getSistemaMapRefs(sistemaId, sistemas, connections)
    .map(({ id: value, sistemaId: ownerId }) => {
      const file = mapFiles.find((map) => map.id === value)
      return { value, file, url: file?.url || value, inherited: ownerId !== sistemaId }
    })
    .filter((map) => !isTrashed(map.file))
    // Newest first, the undated last.
    .sort((a, b) => compareMapsByDate(a.file, b.file))
  const mapWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio
  const mapHeight = ASSETS_LIST_CONFIG.height

  useEffect(() => {
    const scrollbar = scrollbarsRef.current
    const container = scrollbar?.container
    if (!container) return undefined

    function onWheel(event) {
      event.preventDefault()
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const maxScrollLeft = scrollWidth - clientWidth
      const direction = Math.sign(event.deltaY || event.deltaX)
      if (!direction || maxScrollLeft <= 0) return
      scrollStrip(scrollbar.view, event)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    const stopSnapping = snapOnSettle(scrollbar.view, container)
    return () => {
      container.removeEventListener('wheel', onWheel)
      stopSnapping()
    }
  }, [selectedMaps.length])

  const pendingMapsOf = useCallback((item) => item.kind === 'map' && item.sistemaId === sistemaId, [sistemaId])

  return (
    <>
      {/* Maps added offline to this system, waiting to upload. */}
      <PendingUploadsStrip filter={pendingMapsOf} sx={{ px: 'var(--oc-pane-padding-inline)', mb: 2 }} />
      {selectedMaps.length > 0 && (
        <Box className="oc-media-strip" sx={{ height: `calc(var(--oc-pane-padding-block) + ${mapHeight}px)`, mb: 'calc(var(--oc-pane-padding-block) * -1)' }}>
          <Scrollbars ref={scrollbarsRef} autoHide autoHeight autoHeightMax={mapHeight + 100} trackHorizontalProps={{ style: { left: 'calc(var(--oc-pane-padding-inline) / 2)', right: 'calc(var(--oc-pane-padding-inline) / 2)', bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)` } }}>
            <Box onFocus={(event) => centerFocused(event, scrollbarsRef.current?.view)} onKeyDown={leaveOnArrow} sx={{ display: 'flex', gap: `${ASSETS_LIST_CONFIG.spacing}px`, px: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              {selectedMaps.map((map, index) => (
                <Box key={`${map.value}-${index}`} className="oc-cave-map-list--item oc-media-strip--item"
                  sx={(theme) => ({
                    position: 'relative', width: mapWidth, height: mapHeight, flex: '0 0 auto', borderRadius: '.5rem', overflow: 'hidden',
                    // A thin outline over the picture's edge (not around it: the size stays).
                    '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: 'inherit', border: `1px solid ${theme.vars.sys.color.outlineVariant}`, pointerEvents: 'none' },
                  })}>
                  <MapPreview caveId={caveId} map={map} index={index + 1} returnTo={returnTo} mapPath={mapPath} menu={canAdd} />
                  {map.file?.contentType === 'application/pdf' && (
                    <Button component="a" href={map.file.url} target="_blank" rel="noopener noreferrer" size="small" sx={{ position: 'absolute', bottom: 4, left: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}>
                      {t('originalFile')}
                    </Button>
                  )}
                  {canAdd && <CardOptionsMenu ariaLabel={t('mapOptions')} sx={TITLE_BAR_MENU_SX} actions={[{ label: t('editMap'), icon: <EditRounded fontSize="small" />, onClick: () => (mapPath ? navigate(`${mapPath(map.value)}/edit`, { state: { fromPage: true, editFromViewer: true } }) : navigate(`/map/${caveId}/maps/${map.value}/edit`, { state: { from: returnTo } })) }, canTrash && map.file && { label: t('trashMap'), icon: <DeleteForeverRounded fontSize="small" />, onClick: () => requestTrash(map.file), danger: true }].filter(Boolean)} />}
                </Box>
              ))}
            </Box>
          </Scrollbars>
        </Box>
      )}
      <AddMapButton sistemaId={sistemaId} canAdd={canAdd} onAddUnauthorized={onAddUnauthorized} spaced={selectedMaps.length > 0} />

      {trashDialog}


    </>
  )
}
