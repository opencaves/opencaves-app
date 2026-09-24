import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, CircularProgress, Grid, IconButton, SvgIcon, Tooltip, TextField, Typography } from '@mui/material'
import { CenterFocusStrongRounded, MyLocationRounded } from '@mui/icons-material'
import { setPickingCoordinateFor, setEditFieldCoordinate, clearEditFieldCoordinate, clearPickedCoordinate, requestFlyToCoordinate } from '@/redux/slices/mapSlice.jsx'
import PinIcon from '@/images/map/pin.svg?react'

const PIN_SIZE = 28

// Longitude/latitude pair. When empty, a draggable pin sits next to the
// fields - dropping it on the map (see Map.jsx's onDrop) reads its bottom
// tip's position as the chosen coordinate. Once set, the pin itself lives on
// the map instead (a draggable Marker rendered by Map.jsx from
// editFieldCoordinates) so the field can be repositioned directly there.
export default function CoordinateField({ field, label, longitude, latitude, onChange }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const pickedCoordinate = useSelector(state => state.map.pickedCoordinate)
  const isSet = longitude !== '' && latitude !== ''
  const [locating, setLocating] = useState(false)

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
        onChange({ longitude: position.coords.longitude, latitude: position.coords.latitude })
        setLocating(false)
      },
      (error) => {
        console.error('[CoordinateField] geolocation error:', error)
        setLocating(false)
      },
    )
  }

  function onNavigateToClick() {
    dispatch(requestFlyToCoordinate({ longitude: Number(longitude), latitude: Number(latitude) }))
  }

  function onPinDragStart(event) {
    dispatch(setPickingCoordinateFor(field))
    event.dataTransfer.effectAllowed = 'move'
    // The pin's tip is at the bottom-center of its icon - offset the native
    // drag image so the cursor (and therefore the drop point Map.jsx reads)
    // tracks that tip, not wherever on the icon the user grabbed it.
    event.dataTransfer.setDragImage(event.currentTarget, PIN_SIZE / 2, PIN_SIZE)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {!isSet && (
          <Tooltip title={t('dragPinToMap')}>
            <SvgIcon
              component={PinIcon}
              inheritViewBox
              draggable
              onDragStart={onPinDragStart}
              sx={{ width: PIN_SIZE, height: PIN_SIZE, cursor: 'grab', color: 'primary.main' }}
            />
          </Tooltip>
        )}
      </Box>
      <Grid container spacing={1} sx={{ alignItems: 'center' }}>
        <Grid size="auto">
          <TextField
            size="small"
            label={t('longitude')}
            type="number"
            sx={{ width: 130 }}
            value={longitude}
            onChange={(e) => onChange({ longitude: e.target.value, latitude })}
          />
        </Grid>
        <Grid size="auto">
          <TextField
            size="small"
            label={t('latitude')}
            type="number"
            sx={{ width: 130 }}
            value={latitude}
            onChange={(e) => onChange({ longitude, latitude: e.target.value })}
          />
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
        <Grid size="auto">
          <Tooltip title={t('pickMyLocation')}>
            <span>
              <IconButton size="small" onClick={onPickMyLocationClick} disabled={locating}>
                {locating ? <CircularProgress size={16} /> : <MyLocationRounded fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  )
}
