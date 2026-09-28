import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Fab, IconButton, Paper, Typography } from '@mui/material'
import { CheckRounded, CloseRounded, EditNoteRounded } from '@mui/icons-material'
import { endPlaceOnMap, setPickedCoordinate } from '@/redux/slices/mapSlice.jsx'
import { paneBreakpoints } from '@/config/app.js'

const CROSS_SIZE = 48
// Close enough to place a cave entrance precisely.
const PLACE_ZOOM = 17
const COORDINATE_DECIMALS = 5

// The phone edit form's "place on map" mode (mapSlice.placeOnMap), shown over
// the map while ResultPaneSm keeps the sheet minimized:
// - 'place': a fixed cross marks the center of the visible map; the person
//   pans the map under it and confirms (the on-map Confirm button, within
//   thumb reach), which hands the coordinate back to the form's
//   CoordinateField (setPickedCoordinate).
// - 'view': the map just flies to the point (its marker is already on the
//   map), with a "Back to form" button.
// Portaled to <body>: above the search bar (1000) and the sheet (999).
export default function PlaceOnMapOverlay({ mapRef }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const placeOnMap = useSelector((state) => state.map.placeOnMap)
  const currentCave = useSelector((state) => state.map.currentCave)
  const barRef = useRef()
  const [center, setCenter] = useState(null)
  const [pinY, setPinY] = useState(null)

  // The cross's center: the middle of the map area left visible between the
  // top bar and the minimized sheet.
  const computePinY = useCallback(() => {
    const top = barRef.current?.getBoundingClientRect().bottom ?? 0
    const bottom = window.innerHeight * (1 - paneBreakpoints[0])
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
      map.flyTo({ center: target, zoom: Math.max(map.getZoom(), PLACE_ZOOM), offset: [0, y - window.innerHeight / 2], essential: true })
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
    placeOnMap.mode === 'view' ? (
      <Box className="oc-place-on-map oc-place-on-map--view" sx={(theme) => ({ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top))', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: theme.zIndex.appBar, pointerEvents: 'none' })}>
        <Button ref={barRef} variant="contained" startIcon={<EditNoteRounded />} onClick={close} sx={{ pointerEvents: 'auto', borderRadius: 5, boxShadow: 3 }}>
          {t('backToForm')}
        </Button>
      </Box>
    ) : (
      <>
        <Paper
          ref={barRef}
          className="oc-place-on-map oc-place-on-map--bar"
          square
          elevation={3}
          sx={(theme) => ({ position: 'fixed', top: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar, display: 'flex', alignItems: 'center', gap: 1, px: 1, pt: 'calc(8px + env(safe-area-inset-top))', pb: 1 })}
        >
          <IconButton aria-label={t('cancel')} onClick={close} sx={{ width: 48, height: 48 }}>
            <CloseRounded />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 500 }}>
              {t('placeOnMapTitle', { label: placeOnMap.label })}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="p" aria-live="polite">
              {center ? `${center.latitude}, ${center.longitude}` : t('placeOnMapHint')}
            </Typography>
          </Box>
        </Paper>
        {pinY !== null && (
          // Centered on the point being placed. Thin white lines with a dark
          // outline stay visible over any imagery; the gap at the center
          // keeps the exact spot itself uncovered.
          <Box
            component="svg"
            className="oc-place-on-map--cross"
            aria-hidden="true"
            viewBox="0 0 48 48"
            sx={(theme) => ({ position: 'fixed', left: '50%', top: pinY, width: CROSS_SIZE, height: CROSS_SIZE, transform: 'translate(-50%, -50%)', zIndex: theme.zIndex.appBar, pointerEvents: 'none', overflow: 'visible' })}
          >
            <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="5" strokeLinecap="round" />
            <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="24" cy="24" r="2" fill="#fff" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="1.5" />
          </Box>
        )}
        {/* On the map, just above the minimized sheet: within thumb reach
            of where the panning happens. */}
        <Box sx={(theme) => ({ position: 'fixed', left: 0, right: 0, bottom: `calc(${paneBreakpoints[0] * 100}vh + 16px)`, display: 'flex', justifyContent: 'center', zIndex: theme.zIndex.appBar, pointerEvents: 'none' })}>
          <Fab className="oc-place-on-map--confirm" variant="extended" color="primary" onClick={confirm} sx={{ pointerEvents: 'auto', px: 3, textTransform: 'none' }}>
            <CheckRounded sx={{ mr: 1 }} />
            {t('confirm')}
          </Fab>
        </Box>
      </>
    ),
    document.body,
  )
}
