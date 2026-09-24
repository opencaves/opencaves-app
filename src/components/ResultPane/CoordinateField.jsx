import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, CircularProgress, Grid, IconButton, SvgIcon, Tooltip, TextField, Typography } from '@mui/material'
import { CenterFocusStrongRounded, CloseRounded, FenceRounded, MyLocationRounded, VpnKeyRounded } from '@mui/icons-material'
import { setPickingCoordinateFor, setEditFieldCoordinate, clearEditFieldCoordinate, clearPickedCoordinate, requestFlyToCoordinate } from '@/redux/slices/mapSlice.jsx'
import { num } from '@/services/data-service/types.js'
import PinIcon from '@/images/map/pin.svg?react'
import PinBadgeIcon from '@/components/Map/PinBadgeIcon.jsx'

// Special-point fields (as opposed to the cave's own sistema-colored
// location marker) get a white pin badged with a small glyph identifying
// which point it is.
const FIELD_BADGE_ICONS = {
  entrance: FenceRounded,
  key: VpnKeyRounded,
}

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
                <CenterFocusStrongRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        {!isSet && (
          <Grid size="auto">
            <Tooltip title={t('dragPinToMap')}>
              <IconButton size="small" draggable onDragStart={onPinDragStart} sx={{ cursor: 'grab' }}>
                {FIELD_BADGE_ICONS[field] ? (
                  <PinBadgeIcon size={20} overlay={FIELD_BADGE_ICONS[field]} />
                ) : (
                  <SvgIcon component={PinIcon} inheritViewBox sx={{ width: 20, height: 20, color: 'action.active', display: 'block', flexShrink: 0 }} />
                )}
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        <Grid size="auto">
          <Tooltip title={t('pickMyLocation')}>
            <span>
              <IconButton size="small" onClick={onPickMyLocationClick} disabled={locating}>
                {locating ? <CircularProgress size={20} /> : <MyLocationRounded fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
        <Grid size="auto">
          <Tooltip title={t('removeCoordinate')}>
            <span>
              <IconButton size="small" onClick={onClearClick} disabled={!isSet} aria-label={t('removeCoordinate')}>
                <CloseRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  )
}
