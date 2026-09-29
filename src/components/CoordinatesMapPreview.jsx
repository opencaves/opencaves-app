import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Fab, IconButton, Tooltip } from '@mui/material'
import { CheckRounded, CloseRounded, FullscreenExitRounded, FullscreenRounded } from '@mui/icons-material'
import OCMap from '@/components/Map/Map.jsx'
import { endCrossPick, setPickedCoordinate } from '@/redux/slices/mapSlice.jsx'
import { num } from '@/services/data-service/types.js'
import { useSmall } from '@/hooks/useSmall.jsx'

const CROSS_SIZE = 48
// Close enough to aim at a precise spot.
const PLACE_ZOOM = 15

// Inline map beside an edit page's CoordinateFields (cave and sistema admin
// pages). Map.jsx's own CSS fills its nearest positioned ancestor with a
// defined height (it's built to fill the whole /map page) - this box supplies
// both so it renders as an inline preview here instead. Dragging the
// CoordinateField pin icons or clicking the map still works via the same
// pickingCoordinateFor/editFieldCoordinates redux state CoordinateField
// itself dispatches to.
//
// Its corner button makes it cover the whole screen (a fixed overlay, not the
// Fullscreen API, which iPhone Safari only supports for video); the same
// button or Escape brings it back.
//
// On phones a CoordinateField's "Place on map" (mapSlice.crossPickFor) shows
// a fixed cross at the center, like the map's own place-on-map mode: the
// person pans the map under it, then confirms.
//
// hideOnPhones: no map here on phones - the cave page, whose three coordinate
// pairs would otherwise sit above a map that's mostly just in the way there;
// instead, the CoordinateField being placed opens its own right below itself
// (its mapBelowOnPhones), which goes away again once placed.
export default function CoordinatesMapPreview({ hideOnPhones = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const mapRef = useRef()
  const boxRef = useRef()
  const isSmall = useSmall()
  // Taller while placing with the cross: more room to aim.
  const [expanded, setExpanded] = useState(false)
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
    function centerOnTarget() {
      if (cancelled) return
      const map = mapRef.current?.getMap?.()
      if (!map) {
        frame = requestAnimationFrame(centerOnTarget)
        return
      }
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
      dispatch(setPickedCoordinate({ field: crossPickFor, longitude: num(center.lng, 5), latitude: num(center.lat, 5) }))
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
        <IconButton size={fullscreen || isSmall ? 'medium' : 'small'} aria-label={fullscreen ? t('exitFullscreenMap') : t('fullscreenMap')} onClick={() => setFullscreen((v) => !v)} sx={{ ...(isSmall && { width: 48, height: 48 }), position: 'absolute', top: fullscreen ? 'calc(12px + env(safe-area-inset-top))' : 8, right: fullscreen ? 12 : 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
          {fullscreen ? <FullscreenExitRounded /> : <FullscreenRounded fontSize={isSmall ? 'medium' : 'small'} />}
        </IconButton>
      </Tooltip>
      <OCMap mapRef={mapRef} />
      {crossPickFor && (
        <>
          {/* Same cross as PlaceOnMapOverlay: thin white lines with a dark
              outline stay visible over any imagery; the gap at the center
              keeps the exact spot itself uncovered. */}
          <Box component="svg" className="oc-coordinates-map-preview--cross" aria-hidden="true" viewBox="0 0 48 48" sx={{ position: 'absolute', left: '50%', top: '50%', width: CROSS_SIZE, height: CROSS_SIZE, transform: 'translate(-50%, -50%)', zIndex: 1, pointerEvents: 'none', overflow: 'visible' }}>
            <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="5" strokeLinecap="round" />
            <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="24" cy="24" r="2" fill="#fff" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="1.5" />
          </Box>
          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: fullscreen ? 'calc(24px + env(safe-area-inset-bottom))' : 12, display: 'flex', justifyContent: 'center', gap: 1.5, zIndex: 1, pointerEvents: 'none' }}>
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
