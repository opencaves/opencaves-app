import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, CircularProgress, Grid, IconButton, SvgIcon, Tooltip, TextField, Typography } from '@mui/material'
import { CenterFocusStrongRounded, CloseRounded, FenceRounded, MyLocationRounded } from '@mui/icons-material'
import { setPickingCoordinateFor, setEditFieldCoordinate, clearEditFieldCoordinate, clearPickedCoordinate, requestFlyToCoordinate } from '@/redux/slices/mapSlice.jsx'
import { num } from '@/services/data-service/types.js'
import PinIcon from '@/images/map/pin.svg?react'

function EntrancePinIcon({ size = 20 }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <SvgIcon component={PinIcon} inheritViewBox htmlColor="white" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', color: 'white' }} />
      {/* pin.svg's viewBox is 0 0 20 28.15 - a circular head sitting at the
          top tapering to a point at the bottom, so its visual center is
          well above the halfway mark of the full icon's bounding box. */}
      <FenceRounded sx={{ position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: size * 0.55, color: '#111827', lineHeight: 1 }} />
    </Box>
  )
}

const PIN_SIZE = 28

// Longitude/latitude pair. The action row includes a draggable icon that can
// be dropped on the map (see Map.jsx's onDrop) to choose a coordinate. Once
// set, the coordinate itself also lives on the map as a draggable Marker
// rendered by Map.jsx from editFieldCoordinates.
export default function CoordinateField({ field, label, longitude, latitude, onChange }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const pickedCoordinate = useSelector((state) => state.map.pickedCoordinate)
  const isSet = longitude !== '' && latitude !== ''
  const [locating, setLocating] = useState(false)

  function normalizeCoordinateValue(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return ''
    }

    const normalized = Number(num(value, 5))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  useEffect(() => {
    if (pickedCoordinate?.field === field) {
      onChange({ longitude: pickedCoordinate.longitude, latitude: pickedCoordinate.latitude })
      dispatch(clearPickedCoordinate())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCoordinate])

  // Mirror this field's own coordinate into mapSlice so Map.jsx can render
  // a live marker for it. Each dispatch just overwrites the previous value,
  // so this can run on every keystroke without a cleanup - a cleanup here
  // would clear-then-reset the marker (and flicker it) on every change
  // instead of only when the field truly goes away.
  useEffect(() => {
    if (isSet) {
      dispatch(setEditFieldCoordinate({ field, longitude: Number(longitude), latitude: Number(latitude) }))
    } else {
      dispatch(clearEditFieldCoordinate(field))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, longitude, latitude, isSet])

  // Only clear this field's marker on a real unmount (leaving edit mode
  // entirely), not on every value change.
  useEffect(() => {
    return () => {
      dispatch(clearEditFieldCoordinate(field))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field])

  function onPickMyLocationClick() {
    if (!navigator.geolocation) {
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ longitude: normalizeCoordinateValue(position.coords.longitude), latitude: normalizeCoordinateValue(position.coords.latitude) })
        setLocating(false)
      },
      (error) => {
        console.error('[CoordinateField] geolocation error:', error)
        setLocating(false)
      },
    )
  }

  function onNavigateToClick() {
    dispatch(requestFlyToCoordinate({ longitude: Number(num(longitude, 5)), latitude: Number(num(latitude, 5)) }))
  }

  function onClearClick() {
    onChange({ longitude: '', latitude: '' })
  }

  function onPinDragStart(event) {
    dispatch(setPickingCoordinateFor(field))
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
    event.dataTransfer.setData('text/plain', field)
    event.dataTransfer.setData('application/x-opencaves-field', field)
    event.dataTransfer.setDragImage(event.currentTarget, 12, 12)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
      <Grid container spacing={1} sx={{ alignItems: 'center' }}>
        <Grid size="auto">
          <TextField size="small" label={t('longitude')} type="number" sx={{ width: 130 }} value={longitude} onChange={(e) => onChange({ longitude: normalizeCoordinateValue(e.target.value), latitude: normalizeCoordinateValue(latitude) })} />
        </Grid>
        <Grid size="auto">
          <TextField size="small" label={t('latitude')} type="number" sx={{ width: 130 }} value={latitude} onChange={(e) => onChange({ longitude: normalizeCoordinateValue(longitude), latitude: normalizeCoordinateValue(e.target.value) })} />
        </Grid>
        {isSet && (
          <Grid size="auto">
            <Tooltip title={t('navigateToCoordinate')}>
              <IconButton size="small" onClick={onNavigateToClick}>
                <CenterFocusStrongRounded fontSize="small" sx={{ color: 'action.active' }} />
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        {!isSet && (
          <Grid size="auto">
            <Tooltip title={t('dragPinToMap')}>
              <Box component="span" draggable onDragStart={onPinDragStart} sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                {field === 'entrance' ? (
                  <EntrancePinIcon size={20} />
                ) : (
                  <SvgIcon component={PinIcon} inheritViewBox sx={{ width: 20, height: 20, color: 'action.active', display: 'block', flexShrink: 0 }} />
                )}
              </Box>
            </Tooltip>
          </Grid>
        )}
        <Grid size="auto">
          <Tooltip title={t('pickMyLocation')}>
            <span>
              <IconButton size="small" onClick={onPickMyLocationClick} disabled={locating}>
                {locating ? <CircularProgress size={16} /> : <MyLocationRounded fontSize="small" sx={{ color: 'action.active' }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
        <Grid size="auto">
          <Tooltip title={t('removeCoordinate')}>
            <span>
              <IconButton size="small" onClick={onClearClick} disabled={!isSet} aria-label={t('removeCoordinate')}>
                <CloseRounded fontSize="small" sx={{ color: 'action.active' }} />
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  )
}
