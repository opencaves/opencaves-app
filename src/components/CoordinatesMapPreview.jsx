import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Fab, IconButton, Tooltip } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import FullscreenExitRounded from '@mui/icons-material/FullscreenExitRounded'
import FullscreenRounded from '@mui/icons-material/FullscreenRounded'
import OCMap from '@/components/Map/Map.jsx'
import MapPlaceSearch from '@/components/MapPlaceSearch.jsx'
import CrossCoordinates, { CROSS_COORDINATES_OFFSET } from '@/components/CrossCoordinates.jsx'
import { endCrossPick, setPickedCoordinate } from '@/redux/slices/mapSlice.jsx'
import { num } from '@/services/data-service/types.js'
import { useSmall } from '@/hooks/useSmall.jsx'
import { COORDINATE_DECIMALS, PLACE_ZOOM } from '@/config/map.js'
import PlaceCross from '@/components/Map/PlaceCross.jsx'


/**
 * Inline map beside an edit page's CoordinateFields (cave and sistema admin
 * pages). Map.jsx's own CSS fills its nearest positioned ancestor with a
 * defined height (it's built to fill the whole /map page) - this box supplies
 * both so it renders as an inline preview here instead. Dragging the
 * CoordinateField pin icons or clicking the map still works via the same
 * pickingCoordinateFor/editFieldCoordinates redux state CoordinateField
 * itself dispatches to.
 *
 * Its corner button makes it cover the whole screen (a fixed overlay, not the
 * Fullscreen API, which iPhone Safari only supports for video); the same
 * button or Escape brings it back.
 *
 * On phones a CoordinateField's "Place on map" (mapSlice.crossPickFor) shows
 * a fixed cross at the center, like the map's own place-on-map mode: the
 * person pans the map under it, then confirms.
 *
 * @param {object} props
 * @param {boolean} [props.hideOnPhones=false] - No map here on phones - the cave page, whose three coordinate
 *   pairs would otherwise sit above a map that's mostly just in the way there;
 *   instead, the CoordinateField being placed opens its own right below itself
 *   (its mapBelowOnPhones), which goes away again once placed.
 */
export default function CoordinatesMapPreview({ hideOnPhones = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const mapRef = useRef()
  const boxRef = useRef()
  const isSmall = useSmall()
  // Taller while placing with the cross: more room to aim.
  const [expanded, setExpanded] = useState(false)
  // The live coordinates under the cross while placing.
  const [crossCenter, setCrossCenter] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const crossPickFor = useSelector((state) => state.map.crossPickFor)
  const editFieldCoordinates = useSelector((state) => state.map.editFieldCoordinates)

  const hidden = hideOnPhones && isSmall

  // On start: room to aim, the map in view (on phones it's below the
  // fields), and the field's current value - else the cave's location - under
  // the cross. The map may only just be appearing (a CoordinateField's
  // mapBelowOnPhones), so this waits for it to exist and finish loading.
  useEffect(() => {
    if (!crossPickFor || hidden) return undefined
    setExpanded(true)
    const target = editFieldCoordinates[crossPickFor] || editFieldCoordinates.location
    let frame
    let cancelled = false
    let trackedMap = null
    const trackCenter = () => {
      const center = trackedMap?.getCenter()
      if (center) setCrossCenter({ longitude: center.lng, latitude: center.lat })
    }
    function centerOnTarget() {
      if (cancelled) return
      const map = mapRef.current?.getMap?.()
      if (!map) {
        frame = requestAnimationFrame(centerOnTarget)
        return
      }
      trackedMap = map
      map.on('move', trackCenter)
      trackCenter()
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (!target) return
      const go = () => !cancelled && map.jumpTo({ center: [target.longitude, target.latitude], zoom: Math.max(map.getZoom(), PLACE_ZOOM) })
      if (map.loaded()) go()
      else map.once('load', go)
    }
    centerOnTarget()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      trackedMap?.off('move', trackCenter)
      setCrossCenter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossPickFor])

  // Placing is done: back to the usual size.
  useEffect(() => {
    if (!crossPickFor) setExpanded(false)
  }, [crossPickFor])

  useEffect(() => {
    if (!fullscreen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  // Closing ends placing without changing the field (and hides a map
  // opened only for it, see hideOnPhones).

  function close() {
    setFullscreen(false)
    dispatch(endCrossPick())
  }

  function confirm() {
    const center = mapRef.current?.getCenter()
    if (center) {
      dispatch(setPickedCoordinate({ field: crossPickFor, longitude: num(center.lng, COORDINATE_DECIMALS), latitude: num(center.lat, COORDINATE_DECIMALS) }))
    }
    dispatch(endCrossPick())
  }

  if (hidden) {
    return null
  }

  return (
    <Box
      ref={boxRef}
      className={`oc-coordinates-map-preview${fullscreen ? ' oc-coordinates-map-preview--fullscreen' : ''}`}
      sx={
        fullscreen
          ? (theme) => ({ position: 'fixed', inset: 0, zIndex: theme.zIndex.modal, bgcolor: 'background.paper' })
          : { position: 'relative', width: '100%', aspectRatio: expanded ? '4 / 3' : '16 / 9', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: crossPickFor ? 'primary.main' : 'divider', transition: (theme) => theme.transitions.create('aspect-ratio') }
      }
    >
      <Tooltip title={fullscreen ? t('exitFullscreenMap') : t('fullscreenMap')}>
        <IconButton size={fullscreen || isSmall ? 'medium' : 'small'} aria-label={fullscreen ? t('exitFullscreenMap') : t('fullscreenMap')} onClick={() => setFullscreen((v) => !v)} sx={{ position: 'absolute', top: fullscreen ? 'calc(12px + env(safe-area-inset-top))' : 8, right: fullscreen ? 12 : 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
          {fullscreen ? <FullscreenExitRounded /> : <FullscreenRounded />}
        </IconButton>
      </Tooltip>
      {/* Top left, up to the full-screen button (its 48dp touch target + margins). */}
      <Box className="oc-coordinates-map-preview--search" sx={{ position: 'absolute', zIndex: 2, top: fullscreen ? 'calc(12px + env(safe-area-inset-top))' : 8, left: fullscreen ? 12 : 8, right: fullscreen ? 72 : 64, maxWidth: 360 }}>
        <MapPlaceSearch mapRef={mapRef} />
      </Box>
      <OCMap mapRef={mapRef} />
      {crossPickFor && (
        <>
          <PlaceCross sx={{ position: 'absolute', left: '50%', top: '50%', zIndex: 1 }} />
          {/* Centered in the room left of the map's own locate button (bottom
              right), which they'd otherwise overlap on phones. */}
          <CrossCoordinates center={crossCenter} sx={{ position: 'absolute', left: '50%', top: `calc(50% + ${CROSS_COORDINATES_OFFSET}px)`, zIndex: 1 }} />
          <Box sx={{ position: 'absolute', left: 8, right: 72, bottom: fullscreen ? 'calc(24px + env(safe-area-inset-bottom))' : 12, display: 'flex', justifyContent: 'center', gap: 1.5, zIndex: 1, pointerEvents: 'none' }}>
            {crossPickFor && (
              <Fab className="oc-coordinates-map-preview--close" variant="extended" size="medium" onClick={close} sx={{ pointerEvents: 'auto', px: 2.5, textTransform: 'none', bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'background.paper' } }}>
                <CloseRounded sx={{ mr: 1 }} />
                {t('closeMap')}
              </Fab>
            )}
            <Fab className="oc-coordinates-map-preview--confirm" variant="extended" size="medium" color="primary" onClick={confirm} sx={{ pointerEvents: 'auto', px: 2.5, textTransform: 'none' }}>
              <CheckRounded sx={{ mr: 1 }} />
              {t('confirm')}
            </Fab>
          </Box>
        </>
      )}
    </Box>
  )
}
