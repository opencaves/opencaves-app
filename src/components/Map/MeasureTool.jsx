import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Layer, Marker, Source } from 'react-map-gl/mapbox'
import { Box, Button, IconButton, Paper, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import UndoRounded from '@mui/icons-material/UndoRounded'
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded'
import { setMeasuring } from '@/redux/slices/mapSlice.jsx'
import { MEASURE_LABEL_MIN_PX, MEASURE_SNAP_RADIUS_PX } from '@/config/map.js'
import { PANE_BREAKPOINTS } from '@/config/app.js'
import { getPhoneSheet } from '@/components/ResultPane/phoneSheetControl.js'
import { useUnits } from '@/hooks/useUnits.jsx'
import { distanceMetres, pathMetres } from '@/utils/geoDistance.js'
import { formatMeasuredDistance } from '@/utils/units.js'
import './MeasureTool.scss'

const SOURCE_ID = 'oc-measure'

// The measured line's width (its dark casing 2px wider).
const LINE_WIDTH = 3
// A point's ring, half its width on screen (MeasureTool.scss: 16px, 20px
// on a cave), where the line stops.
const ringRadius = (point) => (point.caveId ? 10 : 8)

// Mapbox names every marker's wrapper "Map marker" (role img): a point's own
// element is the named, focusable one.
function unlabelMarker(marker) {
  const element = marker?.getElement()
  element?.removeAttribute('role')
  element?.removeAttribute('aria-label')
}
// Over the cave pins (z-index 1 when active), which Mapbox may add after
// them as the map pans (Map.jsx renders the pins in view only).
const POINT_STYLE = { zIndex: 3 }
const LABEL_STYLE = { zIndex: 2, pointerEvents: /** @type {const} */ ('none') }

/**
 * @typedef {object} MeasurePoint
 * @property {number} id - Its key, for its marker.
 * @property {number} longitude
 * @property {number} latitude
 * @property {string} [caveId] - Snapped to this cave's location.
 * @property {string} [caveName] - That cave's name.
 */

/**
 * @typedef {object} MeasureToolHandle
 * @property {(cave: Cave) => void} addCave - Adds a point on a cave's location (its pin clicked).
 */

/**
 * The map's Measure tool, while mapSlice's `measuring` is on (MeasureButton):
 * each click or tap on the map adds a point, a line joins them with each
 * segment's great-circle length at its middle ({@link distanceMetres}), and a
 * panel at the bottom gives the total in the reader's units
 * ({@link formatMeasuredDistance}) with Undo, Clear and Done (Escape too),
 * and a metric/imperial switch for the measurement alone (the app's units
 * setting doesn't change, nor is the switch saved).
 * A point put down or dragged near a cave's pin ({@link MEASURE_SNAP_RADIUS_PX})
 * goes exactly on the cave. The points are draggable, the lengths following,
 * and focusable (Tab, a click or a drag): Delete or Backspace removes the
 * focused one, its neighbours joined.
 * Rendered inside the map (its line, points and labels); the panel is
 * portaled to the map's container, outside Mapbox's, so its clicks aren't
 * the map's. Map.jsx keeps the pins' and the map's own click actions off
 * meanwhile, and hands it the pins' clicks (`ref`'s addCave). Nothing is
 * saved; the URL doesn't change.
 *
 * On phones it lowers the result sheet to its lowest snap point while it's
 * on (put back after), and its panel rides above the sheet
 * (--oc-result-pane-sm-height), fading with the map's other controls.
 *
 * @param {object} props
 * @param {React.RefObject} props.mapRef - The map (react-map-gl's MapRef).
 * @param {Cave[]} props.caves - The caves with a pin on the map: the ones points snap to.
 * @param {HTMLElement} [props.panelContainer] - Where the panel goes (the map page's container).
 * @param {boolean} props.isSmall - A phone's layout.
 * @param {number} [props.insetLeft=0] - How much of the map's left the panes cover (a computer's): the panel centres in the rest.
 * @param {React.Ref<MeasureToolHandle>} [props.ref]
 */
export default function MeasureTool({ mapRef, caves, panelContainer, isSmall, insetLeft = 0, ref }) {
  const { t, i18n } = useTranslation('map', { keyPrefix: 'measure' })
  const theme = useTheme()
  const dispatch = useDispatch()
  // The units the measurement shows: the reader's, until switched in the
  // panel - for the tool only (the app's own setting doesn't change).
  const readerUnits = useUnits()
  const [chosenUnits, setChosenUnits] = useState(/** @type {'metric'|'imperial'|null} */ (null))
  const units = chosenUnits ?? readerUnits
  const [points, setPoints] = useState(/** @type {MeasurePoint[]} */ ([]))
  const [dragging, setDragging] = useState(false)
  // Re-rendered on zoom: which segments are long enough on screen for a
  // label, and where the line stops at the rings (line).
  const [zoomTick, setZoomTick] = useState(0)
  const nextId = useRef(1)
  const [touch] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)

  const cavesRef = useRef(caves)
  cavesRef.current = caves

  // The cave whose pin is within the snap radius of this screen point, nearest first.
  function snapCave(x, y) {
    const map = mapRef.current
    if (!map) return null
    let best = null
    let bestDistance = MEASURE_SNAP_RADIUS_PX
    for (const cave of cavesRef.current || []) {
      if (!cave.location) continue
      const projected = map.project([cave.location.longitude, cave.location.latitude])
      const distance = Math.hypot(projected.x - x, projected.y - y)
      if (distance <= bestDistance) {
        best = cave
        bestDistance = distance
      }
    }
    return best
  }

  // A point at a place on the map, or on the cave whose pin is there.
  function pointAt(lngLat, x, y) {
    const cave = snapCave(x, y)
    return cave ? onCave(cave) : { longitude: lngLat.lng, latitude: lngLat.lat }
  }

  const onCave = (cave) => ({ longitude: cave.location.longitude, latitude: cave.location.latitude, caveId: cave.id, caveName: cave.name?.value })

  function addPoint(point) {
    setPoints((current) => [...current, { id: nextId.current++, ...point }])
  }

  useImperativeHandle(ref, () => ({ addCave: (cave) => cave.location && addPoint(onCave(cave)) }), [])

  // A point removed from the keyboard: its neighbours joined, the focus on
  // the one that took its place (the next, else the previous; Done if none).
  const pointElements = useRef(/** @type {Map<number, HTMLElement>} */ (new Map()))
  const focusIndex = useRef(/** @type {number|null} */ (null))
  const doneRef = useRef(/** @type {HTMLButtonElement} */ (null))
  function removePoint(id) {
    setPoints((current) => {
      focusIndex.current = current.findIndex((point) => point.id === id)
      return current.filter((point) => point.id !== id)
    })
  }
  useEffect(() => {
    if (focusIndex.current === null) return
    const target = points[Math.min(focusIndex.current, points.length - 1)]
    focusIndex.current = null
    ;(target ? pointElements.current.get(target.id) : doneRef.current)?.focus({ preventScroll: true })
  }, [points])

  function done() {
    dispatch(setMeasuring(false))
  }

  // The map's clicks add points; double-click zoom is off meanwhile (two
  // quick points would zoom in). A click on a marker - a pin (Map.jsx hands
  // it over) or a point - isn't one.
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return undefined
    const onClick = (event) => {
      if (event.originalEvent?.target?.closest?.('.mapboxgl-marker')) return
      addPoint(pointAt(event.lngLat, event.point.x, event.point.y))
    }
    // Which labels fit, again as the map zooms - once a frame at most.
    let frame = 0
    const onZoom = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setZoomTick((tick) => tick + 1)
      })
    }
    const doubleClickZoom = map.doubleClickZoom.isEnabled()
    map.doubleClickZoom.disable()
    map.on('click', onClick)
    map.on('zoom', onZoom)
    return () => {
      cancelAnimationFrame(frame)
      map.off('click', onClick)
      map.off('zoom', onZoom)
      if (doubleClickZoom) map.doubleClickZoom.enable()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef])

  // Escape: done (not while typing - the search field's own Escape).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.target?.closest?.('input, textarea, [contenteditable="true"]')) return
      done()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phones: the sheet down to its lowest point while measuring, so the map
  // shows; back where it was after (if it's still the same sheet).
  useEffect(() => {
    if (!isSmall) return undefined
    const sheet = getPhoneSheet()
    if (!sheet) return undefined
    let restore = null
    let cancelled = false
    Promise.resolve(sheet.getCurrentBreakpoint()).then((breakpoint) => {
      if (cancelled || breakpoint <= PANE_BREAKPOINTS[0]) return
      restore = breakpoint
      sheet.setCurrentBreakpoint(PANE_BREAKPOINTS[0])
    })
    return () => {
      cancelled = true
      if (restore !== null && getPhoneSheet() === sheet) sheet.setCurrentBreakpoint(restore)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onDrag(id, event) {
    const { lng, lat } = event.lngLat
    setPoints((current) => current.map((point) => (point.id === id ? { id, longitude: lng, latitude: lat } : point)))
  }

  function onDragEnd(id, event) {
    setDragging(false)
    const map = mapRef.current
    if (!map) return
    const { x, y } = map.project(event.lngLat)
    const point = pointAt(event.lngLat, x, y)
    setPoints((current) => current.map((existing) => (existing.id === id ? { id, ...point } : existing)))
  }

  const format = (metres) => formatMeasuredDistance(metres, units, i18n.language)
  const total = pathMetres(points)

  // Each segment on its own, stopping at its points' rings (their centres
  // are see-through: the line mustn't show inside them) - cut short by a
  // ring's radius on screen, so made again as the map zooms.
  const line = useMemo(() => {
    const map = mapRef.current
    const features = points.slice(1).flatMap((point, index) => {
      const previous = points[index]
      let from = [previous.longitude, previous.latitude]
      let to = [point.longitude, point.latitude]
      if (map) {
        const a = map.project(from)
        const b = map.project(to)
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        const startCut = ringRadius(previous) / length
        const endCut = ringRadius(point) / length
        if (startCut + endCut >= 1) return []
        const along = (fraction) => [previous.longitude + (point.longitude - previous.longitude) * fraction, previous.latitude + (point.latitude - previous.latitude) * fraction]
        from = along(startCut)
        to = along(1 - endCut)
      }
      return [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, to] } }]
    })
    return { type: 'FeatureCollection', features }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, zoomTick])

  // Each segment's length at its middle, if it's long enough on screen.
  const map = mapRef.current
  const labels = points.slice(1).flatMap((point, index) => {
    const previous = points[index]
    if (map) {
      const a = map.project([previous.longitude, previous.latitude])
      const b = map.project([point.longitude, point.latitude])
      if (Math.hypot(a.x - b.x, a.y - b.y) < MEASURE_LABEL_MIN_PX) return []
    }
    return [{ id: point.id, longitude: (previous.longitude + point.longitude) / 2, latitude: (previous.latitude + point.latitude) / 2, text: format(distanceMetres(previous, point)) }]
  })

  // The line: the theme's secondary (gold, a tape measure's), the same in
  // both schemes - the imagery under it doesn't change with them - edged in
  // a dark casing that keeps it readable on any ground.
  const rulerColor = theme.palette.secondary.main

  const panel = (
    <Paper
      component="section"
      className={`oc-measure-tool--panel${isSmall ? ' oc-measure-tool--panel-sm' : ''}`}
      aria-label={t('button')}
      elevation={3}
      style={{ '--oc-measure-inset-left': `${insetLeft}px` }}
      sx={(theme) => ({ bgcolor: theme.vars.sys.color.surfaceContainerHigh })}
    >
      <Box className="oc-measure-tool--summary">
        {/* The hint until there's a distance (a phone's: over the map, the panel being narrow). */}
        {points.length < 2 && !isSmall ? (
          <Typography variant="body2" className="oc-measure-tool--hint">
            {t(touch ? 'hintTap' : 'hintClick')}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" component="p" className="oc-measure-tool--total-label">
              {t(isSmall ? 'totalShort' : 'total')}
            </Typography>
            <Typography variant="subtitle1" component="p" className="oc-measure-tool--total">
              {format(total)}
            </Typography>
          </>
        )}
        {/* Read out when a point is added, moved or removed - not every frame of a drag. */}
        <Box component="span" className="oc-measure-tool--live" aria-live="polite">
          {!dragging && points.length > 1 ? `${t('total')} ${format(total)}` : ''}
        </Box>
      </Box>
      <ToggleButtonGroup
        className="oc-measure-tool--units"
        size="small"
        exclusive
        value={units}
        onChange={(event, value) => value && setChosenUnits(value)}
        aria-label={t('units')}
      >
        <ToggleButton value="metric" aria-label={t('metric')}>
          {t('metricShort')}
        </ToggleButton>
        <ToggleButton value="imperial" aria-label={t('imperial')}>
          {t('imperialShort')}
        </ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title={t('undo')}>
        <span>
          <IconButton className="oc-measure-tool--undo" aria-label={t('undo')} disabled={points.length === 0} onClick={() => setPoints((current) => current.slice(0, -1))}>
            <UndoRounded />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('clear')}>
        <span>
          <IconButton className="oc-measure-tool--clear" aria-label={t('clear')} disabled={points.length === 0} onClick={() => setPoints([])}>
            <DeleteSweepRounded />
          </IconButton>
        </span>
      </Tooltip>
      <Button ref={doneRef} className="oc-measure-tool--done" variant="contained" disableElevation onClick={done}>
        {t('done')}
      </Button>
    </Paper>
  )

  return (
    <>
      {/* The casing under, the gold over: readable on any ground. */}
      <Source id={SOURCE_ID} type="geojson" data={/** @type {any} */ (line)}>
        <Layer id="oc-measure-casing" type="line" layout={{ 'line-cap': 'butt' }} paint={{ 'line-color': '#000', 'line-opacity': 0.7, 'line-width': LINE_WIDTH + 2 }} />
        <Layer id="oc-measure-line" type="line" layout={{ 'line-cap': 'butt' }} paint={{ 'line-color': rulerColor, 'line-width': LINE_WIDTH }} />
      </Source>
      {labels.map((label) => (
        <Marker key={`label-${label.id}`} longitude={label.longitude} latitude={label.latitude} anchor="center" style={LABEL_STYLE}>
          <div className="oc-measure-tool--label" aria-hidden="true">
            {label.text}
          </div>
        </Marker>
      ))}
      {points.map((point, index) => {
        const name = point.caveId ? t('pointOnCave', { index: index + 1, count: points.length, cave: point.caveName || point.caveId }) : t('point', { index: index + 1, count: points.length })
        return (
          <Marker
            key={point.id}
            ref={unlabelMarker}
            longitude={point.longitude}
            latitude={point.latitude}
            anchor="center"
            draggable
            style={POINT_STYLE}
            onDragStart={() => {
              setDragging(true)
              pointElements.current.get(point.id)?.focus({ preventScroll: true })
            }}
            onDrag={(event) => onDrag(point.id, event)}
            onDragEnd={(event) => onDragEnd(point.id, event)}
          >
            {/* Focusable (Tab, or a click or drag): Delete or Backspace removes it. */}
            <div
              ref={(element) => {
                if (element) pointElements.current.set(point.id, element)
                else pointElements.current.delete(point.id)
              }}
              className={`oc-measure-tool--point${point.caveId ? ' oc-measure-tool--point-snapped' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={name}
              aria-keyshortcuts="Delete Backspace"
              title={point.caveName || undefined}
              onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
              onKeyDown={(event) => {
                if (event.key !== 'Delete' && event.key !== 'Backspace') return
                event.preventDefault()
                event.stopPropagation()
                removePoint(point.id)
              }}
            />
          </Marker>
        )
      })}
      {panelContainer && createPortal(panel, panelContainer)}
      {panelContainer &&
        isSmall &&
        points.length < 2 &&
        createPortal(
          <Typography variant="body2" className="oc-measure-tool--hint-chip" sx={(theme) => ({ bgcolor: theme.vars.sys.color.surfaceContainerHigh, boxShadow: theme.shadows[3] })}>
            {t(touch ? 'hintTap' : 'hintClick')}
          </Typography>,
          panelContainer,
        )}
    </>
  )
}
