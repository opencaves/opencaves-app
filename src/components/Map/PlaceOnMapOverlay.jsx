import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Fab } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { endPlaceOnMap, setPickedCoordinate } from '@/redux/slices/mapSlice.jsx'
import { PANE_BREAKPOINTS } from '@/config/app.js'
import MapPlaceSearch from '@/components/MapPlaceSearch.jsx'
import CrossCoordinates, { CROSS_COORDINATES_OFFSET } from '@/components/CrossCoordinates.jsx'
import { COORDINATE_DECIMALS, PLACE_ZOOM } from '@/config/map.js'
import PlaceCross from '@/components/Map/PlaceCross.jsx'

// Read by screen readers, not drawn.
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }

/**
 * The phone edit form's "place on map" mode (mapSlice.placeOnMap), shown over
 * the map while ResultPaneSm keeps the sheet minimized: a fixed cross marks
 * the center of the visible map; the person pans the map under it (or
 * searches a place) and confirms, which hands the coordinate back to the
 * form's CoordinateField ({@link setPickedCoordinate}) - or closes. Same controls as
 * the admin pages' map preview (CoordinatesMapPreview).
 * Portaled to <body>: above the search bar (1000) and the sheet (999).
 */
export default function PlaceOnMapOverlay({ mapRef }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const placeOnMap = useSelector((/** @type {RootState} */ state) => state.map.placeOnMap)
  const currentCave = useSelector((/** @type {RootState} */ state) => state.map.currentCave)
  const barRef = useRef()
  const [center, setCenter] = useState(null)
  const [pinY, setPinY] = useState(null)

  // The cross's center: the middle of the map area left visible between the
  // top bar and the minimized sheet.
  const computePinY = useCallback(() => {
    const top = barRef.current?.getBoundingClientRect().bottom ?? 0
    const bottom = window.innerHeight * (1 - PANE_BREAKPOINTS[0])
    return Math.round((top + bottom) / 2)
  }, [])

  const readCenter = useCallback(
    (y) => {
      const map = mapRef.current
      if (!map) return null
      const { lng, lat } = map.unproject([window.innerWidth / 2, y])
      return { longitude: Number(lng.toFixed(COORDINATE_DECIMALS)), latitude: Number(lat.toFixed(COORDINATE_DECIMALS)) }
    },
    [mapRef],
  )

  // On start: bring the target (the field's own value, else the cave, else
  // wherever the map already is) under the cross.
  useEffect(() => {
    if (!placeOnMap) return undefined
    const map = mapRef.current
    if (!map) return undefined

    const y = computePinY()
    setPinY(y)
    const target =
      placeOnMap.longitude !== undefined && placeOnMap.longitude !== ''
        ? [Number(placeOnMap.longitude), Number(placeOnMap.latitude)]
        : currentCave?.location
          ? [currentCave.location.longitude, currentCave.location.latitude]
          : null
    if (target) {
      map.flyTo({ center: target, zoom: Math.max(map.getZoom(), PLACE_ZOOM), offset: [0, y - window.innerHeight / 2] })
    }

    const onMove = () => setCenter(readCenter(y))
    onMove()
    map.on('move', onMove)
    return () => map.off('move', onMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeOnMap])

  if (!placeOnMap) {
    return null
  }

  function close() {
    dispatch(endPlaceOnMap())
  }

  function confirm() {
    const picked = readCenter(pinY ?? computePinY())
    if (picked) {
      dispatch(setPickedCoordinate({ field: placeOnMap.field, ...picked }))
    }
    close()
  }

  return createPortal(
      <>
        {/* The admin pages' map controls (CoordinatesMapPreview): the place
            search on top, Close and Confirm at the bottom. */}
        <Box ref={barRef} className="oc-place-on-map oc-place-on-map--bar" sx={(theme) => ({ position: 'fixed', top: 'calc(8px + env(safe-area-inset-top))', left: 8, right: 8, zIndex: theme.zIndex.appBar })}>
          <MapPlaceSearch mapRef={mapRef} centerOffsetY={(pinY ?? computePinY()) - window.innerHeight / 2} />
        </Box>
        {/* What's being placed, for screen readers (the coordinates are shown
            above the buttons). */}
        <Box component="p" sx={visuallyHidden}>
          {t('placeOnMapTitle', { label: placeOnMap.label })}
        </Box>
        {pinY !== null && <PlaceCross sx={(theme) => ({ position: 'fixed', left: '50%', top: pinY, zIndex: theme.zIndex.appBar })} />}
        {pinY !== null && <CrossCoordinates center={center} sx={(theme) => ({ position: 'fixed', left: '50%', top: pinY + CROSS_COORDINATES_OFFSET, zIndex: theme.zIndex.appBar })} />}
        {/* On the map, just above the minimized sheet: within thumb reach of
            where the panning happens - and left of the map's locate button. */}
        <Box sx={(theme) => ({ position: 'fixed', left: 8, right: 72, bottom: `calc(${PANE_BREAKPOINTS[0] * 100}vh + 16px)`, display: 'flex', justifyContent: 'center', gap: 1.5, zIndex: theme.zIndex.appBar, pointerEvents: 'none' })}>
          <Fab className="oc-place-on-map--close" variant="extended" size="medium" onClick={close} sx={{ pointerEvents: 'auto', px: 2.5, textTransform: 'none', bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'background.paper' } }}>
            <CloseRounded sx={{ mr: 1 }} />
            {t('closeMap')}
          </Fab>
          <Fab className="oc-place-on-map--confirm" variant="extended" size="medium" color="primary" onClick={confirm} sx={{ pointerEvents: 'auto', px: 2.5, textTransform: 'none' }}>
            <CheckRounded sx={{ mr: 1 }} />
            {t('confirm')}
          </Fab>
        </Box>
      </>,
    document.body,
  )
}
