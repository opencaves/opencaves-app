import { useContext, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, CircularProgress, Grid, IconButton, SvgIcon, Tooltip, TextField, Typography } from '@mui/material'
import { AddLocationAltRounded, CenterFocusStrongRounded, CloseRounded, FenceRounded, MyLocationRounded, VpnKeyRounded } from '@mui/icons-material'
import { setPickingCoordinateFor, setEditFieldCoordinate, clearEditFieldCoordinate, clearPickedCoordinate, requestFlyToCoordinate, startPlaceOnMap, startCrossPick, endCrossPick } from '@/redux/slices/mapSlice.jsx'
import { num } from '@/services/data-service/types.js'
import PinIcon from '@/images/map/pin.svg?react'
import PinBadgeIcon from '@/components/Map/PinBadgeIcon.jsx'
import { ResultPaneSmContext } from './ResultPaneSm.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import CoordinatesMapPreview from '@/components/CoordinatesMapPreview.jsx'

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
//
// Inside the phone sheet (ResultPaneSm) the map is hidden behind the form
// and drag-and-drop doesn't work by touch, so there "Place on map" uses the
// map's place-on-map mode instead (PlaceOnMapOverlay), which minimizes the
// sheet while it runs.

// A phone action: icon over a short label (the label is also its accessible
// name), with at least a 48dp touch target.
function LabeledAction({ icon, label, onClick, disabled }) {
  return (
    <ButtonBase
      className="oc-coordinate-field--action"
      onClick={onClick}
      disabled={disabled}
      sx={{
        flexDirection: 'column',
        gap: 0.5,
        minWidth: 72,
        minHeight: 56,
        px: 1,
        py: 0.75,
        borderRadius: 2,
        color: 'text.secondary',
        '&:hover': { bgcolor: 'action.hover' },
        '&.Mui-disabled': { opacity: 0.38 },
      }}
    >
      {icon}
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, lineHeight: '16px', letterSpacing: '0.5px', textAlign: 'center' }}>
        {label}
      </Typography>
    </ButtonBase>
  )
}
// canPickOnMap: whether there's a map on screen to tap (on phones, the admin
// edit pages' CoordinatesMapPreview); without one, phones only get My
// location and Remove. mapBelowOnPhones: on phones, "Place on map" opens a
// map right below this field instead (for a page whose own map preview is
// hidden on phones, see CoordinatesMapPreview's hideOnPhones).
export default function CoordinateField({ field, label, longitude, latitude, onChange, labelProps = {}, canPickOnMap = true, mapBelowOnPhones = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const pickedCoordinate = useSelector((state) => state.map.pickedCoordinate)
  const picking = useSelector((state) => state.map.crossPickFor === field)
  const placingInSheet = useSelector((state) => state.map.placeOnMap?.field === field)
  const isSet = longitude !== '' && latitude !== ''
  const [locating, setLocating] = useState(false)
  const inPhoneSheet = !!useContext(ResultPaneSmContext)
  const isSmall = useSmall()

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

  function onPlaceOnMapClick() {
    dispatch(startPlaceOnMap({ field, label, ...(isSet && { longitude, latitude }) }))
  }

  // Phones on the admin edit pages: dragging the pin doesn't work by touch,
  // so the map preview's cross instead (CoordinatesMapPreview: pan the map
  // under it, then Confirm or Close - it also brings itself into view).
  function onPickOnMapClick() {
    dispatch(startCrossPick(field))
  }

  // Don't leave the map in pick mode for a field that's gone.
  useEffect(
    () => () => {
      if (picking) dispatch(endCrossPick())
    },
    [picking, dispatch],
  )

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

  // Values are capped at 5 decimals (normalizeCoordinateValue), so the widest
  // is "-180.00000": narrow fields, without the number spinners (useless
  // here, and they'd cover digits in a field this narrow).
  const coordinateInputSx = {
    width: 104,
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { WebkitAppearance: 'none', m: 0 },
  }

  const longitudeInput = <TextField size="small" label={t('longitude')} type="number" sx={coordinateInputSx} value={longitude} onChange={(e) => onChange({ longitude: normalizeCoordinateValue(e.target.value), latitude: normalizeCoordinateValue(latitude) })} />
  const latitudeInput = <TextField size="small" label={t('latitude')} type="number" sx={coordinateInputSx} value={latitude} onChange={(e) => onChange({ longitude: normalizeCoordinateValue(longitude), latitude: normalizeCoordinateValue(e.target.value) })} />
  const inputs = (
    <>
      <Grid size="auto">{longitudeInput}</Grid>
      <Grid size="auto">{latitudeInput}</Grid>
    </>
  )

  const pinIcon = FIELD_BADGE_ICONS[field] ? <PinBadgeIcon size={20} overlay={FIELD_BADGE_ICONS[field]} /> : <SvgIcon component={PinIcon} inheritViewBox sx={{ width: 20, height: 20, color: 'action.active', display: 'block', flexShrink: 0 }} />

  const myLocationButton = (
    <Tooltip title={t('pickMyLocation')} describeChild>
      <span>
        <IconButton size="small" onClick={onPickMyLocationClick} disabled={locating} aria-label={t('pickMyLocation')}>
          {locating ? <CircularProgress size={20} /> : <MyLocationRounded fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  )

  const removeButton = (
    <Tooltip title={t('removeCoordinate')} describeChild>
      <span>
        <IconButton size="small" onClick={onClearClick} disabled={!isSet} aria-label={t('removeCoordinate')}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )

  const navigateOrPinButton = isSet ? (
    <Tooltip title={t('navigateToCoordinate')}>
      <IconButton size="small" onClick={onNavigateToClick} aria-label={t('navigateToCoordinate')}>
        <CenterFocusStrongRounded fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : (
    <Tooltip title={t('dragPinToMap')}>
      <IconButton size="small" draggable onDragStart={onPinDragStart} aria-label={t('dragPinToMap')} sx={{ cursor: 'grab' }}>
        {pinIcon}
      </IconButton>
    </Tooltip>
  )

  return (
    <Box className="oc-coordinate-field">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" {...labelProps}>
          {label}
        </Typography>
      </Box>
      {inPhoneSheet || isSmall ? (
        // Phones: the inputs, then labeled actions on their own row in a
        // fixed order - Remove is disabled, not hidden, while there's nothing
        // to remove, so nothing shifts around as the field fills in. "Place
        // on map" is the sheet's place-on-map mode in the map's result pane,
        // tap-to-pick on the admin pages' map preview.
        <>
          <Grid container spacing={1} sx={{ alignItems: 'center' }}>
            {inputs}
          </Grid>
          <Box className="oc-coordinate-field--actions" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, ml: -1 }}>
            {inPhoneSheet ? <LabeledAction icon={<AddLocationAltRounded />} label={t('coordinateActions.placeOnMap')} onClick={onPlaceOnMapClick} disabled={placingInSheet} /> : canPickOnMap && <LabeledAction icon={<AddLocationAltRounded />} label={t('coordinateActions.placeOnMap')} onClick={onPickOnMapClick} disabled={picking} />}
            <LabeledAction icon={locating ? <CircularProgress size={24} /> : <MyLocationRounded />} label={t('coordinateActions.myLocation')} onClick={onPickMyLocationClick} disabled={locating} />
            <LabeledAction icon={<CloseRounded />} label={t('coordinateActions.remove')} onClick={onClearClick} disabled={!isSet} />
          </Box>
          <Typography className="oc-coordinate-field--pick-hint" variant="body2" color="primary" role="status" sx={{ mt: picking ? 0.5 : 0 }}>
            {picking && !inPhoneSheet ? t('coordinateActions.crossPickHint') : ''}
          </Typography>
          {picking && mapBelowOnPhones && !inPhoneSheet && (
            <Box sx={{ mt: 1 }}>
              <CoordinatesMapPreview />
            </Box>
          )}
        </>
      ) : (
        // Larger screens: everything on one row.
        <Grid container spacing={1} sx={{ alignItems: 'center' }}>
          {inputs}
          <Grid size="auto">{navigateOrPinButton}</Grid>
          <Grid size="auto">{myLocationButton}</Grid>
          <Grid size="auto">{removeButton}</Grid>
        </Grid>
      )}
    </Box>
  )
}
