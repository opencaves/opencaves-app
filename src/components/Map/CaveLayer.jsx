import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Source, Layer, Popup, useMap } from 'react-map-gl/mapbox'
import { Box, Button, IconButton, Link, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { useTheme } from '@mui/material/styles'
import { CAVE_LAYER } from '@/config/map.js'
import { useUnits } from '@/hooks/useUnits.jsx'
import { useCaveLayerMaps } from '@/hooks/useCaveLayerMaps.jsx'
import { useMapScan } from '@/hooks/useMapScan.jsx'
import { setMapHidden } from '@/services/caveLayerSettings.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { METRES_PER_FOOT } from '@/utils/units.js'

// The layers the edit mode answers to: a map's drawing (its symbols are too small).
// Lines first: a wall within reach wins over the water around it.
const EDITABLE_LAYERS = ['oc-caves-walls', 'oc-caves-arianne', 'oc-caves-details', 'oc-caves-water']
// How far from the pointer (px) a drawing answers: most are thin lines.
const HOVER_PADDING = 8
// The drawn lines' halo (the *-halo layers): dark behind a light colour,
// light behind a dark one, so every system's lines stand out over the imagery.
const HALO_OPACITY = 0.55
const DARK_HALO = '#000'
const LIGHT_HALO = '#fff'

// A colour's relative luminance (0 black - 1 white), from #rgb or #rrggbb.
function luminance(hex) {
  const value = String(hex || '').replace('#', '')
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return Number.isFinite(r + g + b) ? 0.2126 * r + 0.7152 * g + 0.0722 * b : 1
}
const haloFor = (hex) => (luminance(hex) < 0.12 ? LIGHT_HALO : DARK_HALO)

// The tiles that exist ("z/x/y"), loaded once: empty tiles have no file, and
// Hosting would answer them with the app's index.html (its catch-all rewrite).
let tileIndex = null
const tileIndexLoading = fetch(CAVE_LAYER.INDEX)
  .then((response) => (response.ok ? response.json() : []))
  .then((tiles) => (tileIndex = new Set(tiles)))
  .catch(() => (tileIndex = new Set()))

// For the map's transformRequest: a cave tile not in the index is answered
// with the empty tile instead of being fetched.
export function caveTileRequest(url) {
  const match = tileIndex && url.match(/\/tiles\/caves\/(\d+\/\d+\/\d+)\.pbf/)
  if (match && !tileIndex.has(match[1])) return { url: new URL(CAVE_LAYER.EMPTY_TILE, window.location.origin).href }
  return { url }
}

// Each sistema's top-level sistema (following the connections up), as the
// cave pins use: a system merged into another shows in that one's colour.
function rootSistemas(sistemas, connections) {
  const parent = new Map((connections || []).filter((c) => c.sistemaId && c.parentSistemaId).map((c) => [c.sistemaId, c.parentSistemaId]))
  const root = (id, seen = new Set()) => (parent.has(id) && !seen.has(id) ? root(parent.get(id), seen.add(id)) : id)
  return new Map((sistemas || []).map((s) => [s.id, root(s.id)]))
}

// The edit mode's card for a clicked drawing: its map (title, date, system,
// config file, the scan it was traced from), and hiding or showing it - the
// primary action - or closing.
function EditCard({ map, hidden, sistemaName, onHide, onShow, onClose }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.edit' })
  const scan = useMapScan(map?.mapImportKey)
  const system = sistemaName(map?.sistemaId)
  return (
    <Box className="oc-cave-layer-edit-card--content" sx={{ position: 'relative' }}>
      <IconButton aria-label={t('close')} onClick={onClose} sx={{ position: 'absolute', top: -10, right: -12 }}>
        <CloseRounded />
      </IconButton>
      <Typography variant="subtitle2" sx={{ pr: 4 }}>
        {map?.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {map?.date ? t('date', { date: map.date }) : t('undated')}
      </Typography>
      {system && (
        <Typography variant="caption" color="text.secondary" component="p">
          {t('system', { name: system })}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="p">
        {t('file', { name: map?.name })}
      </Typography>
      {scan?.url && (
        <Link href={scan.url} target="_blank" rel="noopener" variant="caption" sx={{ display: 'inline-block', mt: 0.5 }}>
          {t('openScan')}
        </Link>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
        <Button size="small" onClick={onClose}>
          {t('close')}
        </Button>
        <Button size="small" variant="contained" disableElevation onClick={hidden ? onShow : onHide}>
          {hidden ? t('showDrawing') : t('hide')}
        </Button>
      </Box>
    </Box>
  )
}

// The cave layer: the passages traced from the cave survey maps (walls,
// survey lines, water, drawn details) and their symbols (entrances, depths,
// place names, flow), with the options of the map's layer button (the
// caveLayer slice): shown or not; every system or only the selected cave's
// (selectedSistemaId: its system and the ones merged into it); each system in
// its colour (from the database: a colour changed in the admin UI shows
// without rebuilding the tiles) or all in one colour. The maps whose drawing
// editors hid (caveLayerSettings) are left out for everyone - shown in grey in
// the edit mode (editors), where the map under the pointer is outlined and
// named, and a click on it offers to hide its drawing, or show it again.
// mapId: that map's drawing only, always shown (even hidden for everyone) and
// never in the edit mode - the admin's original-vs-drawing viewer.
export default function CaveLayer({ selectedSistemaId, mapId }) {
  const theme = useTheme()
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.edit' })
  const [openSnackbar] = useSnackbar()
  const { current: map } = useMap()
  const sistemas = useSelector((state) => state.data.sistemas)
  const connections = useSelector((state) => state.data.connections)
  const roles = useSelector((state) => state.session.roles)
  const { visible, scope, colorBySistema, editMode: editModeChosen } = useSelector((state) => state.caveLayer)
  const editMode = !mapId && editModeChosen && visible && roles.includes('editor')
  const { maps, hiddenMaps } = useCaveLayerMaps()
  const units = useUnits()
  const [ready, setReady] = useState(Boolean(tileIndex))
  // Edit mode: the map under the pointer ({ name, lngLat }), and the one clicked.
  const [hovered, setHovered] = useState(null)
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    if (!ready) tileIndexLoading.then(() => setReady(true))
  }, [ready])

  useEffect(() => {
    if (!editMode || !ready || !map) {
      setHovered(null)
      setPicked(null)
      return undefined
    }
    // The map drawn nearest the pointer: the drawings within HOVER_PADDING of
    // it, lines before water.
    const target = (event) => {
      const { x, y } = event.point
      const layers = EDITABLE_LAYERS.filter((id) => map.getLayer(id))
      const features = layers.length ? map.queryRenderedFeatures([[x - HOVER_PADDING, y - HOVER_PADDING], [x + HOVER_PADDING, y + HOVER_PADDING]], { layers }) : []
      const feature = features.find((f) => f.layer.id !== 'oc-caves-water') || features[0]
      return feature ? { name: feature.properties.map, lngLat: event.lngLat } : null
    }
    const onMove = (event) => {
      const next = target(event)
      map.getCanvas().style.cursor = next ? 'pointer' : ''
      setHovered((current) => (next && current?.name === next.name ? { ...current, lngLat: next.lngLat } : next))
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      setHovered(null)
    }
    const onClick = (event) => {
      const next = target(event)
      if (next) setPicked(next)
    }
    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    map.on('click', onClick)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
    }
  }, [editMode, ready, map])

  // The clicked map's drawing hidden for everyone, or shown again.
  async function setPickedHidden(hidden) {
    const { name } = picked
    setPicked(null)
    setHovered(null)
    try {
      await setMapHidden(name, hidden)
      openSnackbar(t(hidden ? 'hidden' : 'shown', { title: maps[name]?.title || name }), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t(hidden ? 'hideError' : 'showError'))
    }
  }


  const roots = useMemo(() => rootSistemas(sistemas, connections), [sistemas, connections])
  const single = theme.palette.primary.light
  const color = useMemo(() => {
    const colors = new Map((sistemas || []).map((s) => [s.id, s.color]))
    const pairs = colorBySistema ? [...roots].filter(([, root]) => colors.get(root)).flatMap(([id, root]) => [id, colors.get(root)]) : []
    return pairs.length ? ['match', ['get', 'sistemaId'], ...pairs, single] : single
  }, [sistemas, roots, colorBySistema, single])
  // Each line's halo, from its colour's lightness.
  const halo = useMemo(() => {
    const colors = new Map((sistemas || []).map((s) => [s.id, s.color]))
    const pairs = colorBySistema ? [...roots].filter(([, root]) => colors.get(root)).flatMap(([id, root]) => [id, haloFor(colors.get(root))]) : []
    return pairs.length ? ['match', ['get', 'sistemaId'], ...pairs, haloFor(single)] : haloFor(single)
  }, [sistemas, roots, colorBySistema, single])
  // Only the selected cave's system: every sistema under the same top-level one.
  const sistemaIds = useMemo(() => {
    if (scope !== 'selected' || !selectedSistemaId) return []
    const root = roots.get(selectedSistemaId) || selectedSistemaId
    return [...roots].filter(([, r]) => r === root).map(([id]) => id)
  }, [scope, selectedSistemaId, roots])

  if (!ready) return null
  const visibility = visible || mapId ? 'visible' : 'none'
  const only = mapId ? [['==', ['get', 'map'], mapId]] : sistemaIds.length ? [['in', ['get', 'sistemaId'], ['literal', sistemaIds]]] : []
  // Hidden drawings: left out - but in the edit mode, kept in grey and faded.
  const isHidden = ['in', ['get', 'map'], ['literal', hiddenMaps]]
  const shown = hiddenMaps.length && !editMode && !mapId ? [['!', isHidden]] : []
  const filter = (...conditions) => ['all', ...conditions, ...only, ...shown]
  const greyed = editMode && hiddenMaps.length
  const ifHidden = (hidden, normal) => (greyed ? ['case', isHidden, hidden, normal] : normal)
  const HIDDEN_COLOR = theme.palette.grey[500]
  const HIDDEN_OPACITY = 0.45
  // Edit mode: the hovered and the clicked map, outlined.
  const outlined = [...new Set([hovered?.name, picked?.name].filter(Boolean))]
  const sistemaName = (id) => { const name = (sistemas || []).find((s) => s.id === id)?.name; return typeof name === 'string' ? name : name?.value }
  const kind = (...kinds) => ['in', ['get', 'kind'], ['literal', kinds]]
  const type = (t) => ['==', ['get', 'type'], t]
  const tiles = [new URL(CAVE_LAYER.TILES, window.location.origin).href.replace(/%7B/g, '{').replace(/%7D/g, '}')]

  return (
    <Source id="oc-caves" type="vector" tiles={tiles} minzoom={CAVE_LAYER.MIN_ZOOM} maxzoom={CAVE_LAYER.MAX_ZOOM}>
      <Layer id="oc-caves-water" source-layer="passages" type="fill" filter={filter(kind('water'))} layout={{ visibility }} paint={{ 'fill-color': ifHidden(HIDDEN_COLOR, CAVE_LAYER.WATER_COLOR), 'fill-opacity': ifHidden(CAVE_LAYER.WATER_OPACITY * HIDDEN_OPACITY, CAVE_LAYER.WATER_OPACITY) }} />
      {/* A halo under the drawn lines (a wider, blurred, translucent copy
          beneath them: dark, or light behind a dark colour), so they stand
          out over any imagery - some maps' colours are close to the forest's. */}
      <Layer id="oc-caves-details-halo" source-layer="passages" type="line" minzoom={CAVE_LAYER.DETAIL_ZOOM} filter={filter(kind('detail'))} layout={{ visibility }}
        paint={{ 'line-color': ifHidden(DARK_HALO, halo), 'line-opacity': ifHidden(HIDDEN_OPACITY * HALO_OPACITY, HALO_OPACITY), 'line-blur': 1, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2.8, 18, 3.4] }} />
      <Layer id="oc-caves-details" source-layer="passages" type="line" minzoom={CAVE_LAYER.DETAIL_ZOOM} filter={filter(kind('detail'))} layout={{ visibility }}
        paint={{ 'line-color': ifHidden(HIDDEN_COLOR, color), 'line-opacity': ifHidden(HIDDEN_OPACITY, 1), 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 18, 1.4] }} />
      {/* Floor reliefs (a line and its ticks) and slopes (V's pointing
          downhill), redrawn by the tracing: drawn like the walls, from the
          details' zoom. */}
      <Layer id="oc-caves-reliefs-halo" source-layer="passages" type="line" minzoom={CAVE_LAYER.DETAIL_ZOOM} filter={filter(kind('relief', 'slope'))} layout={{ visibility, 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(DARK_HALO, halo), 'line-opacity': ifHidden(HIDDEN_OPACITY * HALO_OPACITY, HALO_OPACITY), 'line-blur': 1, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 4.5] }} />
      <Layer id="oc-caves-reliefs" source-layer="passages" type="line" minzoom={CAVE_LAYER.DETAIL_ZOOM} filter={filter(kind('relief', 'slope'))} layout={{ visibility, 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(HIDDEN_COLOR, color), 'line-opacity': ifHidden(HIDDEN_OPACITY, 1), 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.2, 18, 2.5] }} />
      <Layer id="oc-caves-walls-halo" source-layer="passages" type="line" filter={filter(kind('wall'))} layout={{ visibility, 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(DARK_HALO, halo), 'line-opacity': ifHidden(HIDDEN_OPACITY * HALO_OPACITY, HALO_OPACITY), 'line-blur': 1, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 18, 4.5] }} />
      <Layer id="oc-caves-walls" source-layer="passages" type="line" filter={filter(kind('wall'))} layout={{ visibility, 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(HIDDEN_COLOR, color), 'line-opacity': ifHidden(HIDDEN_OPACITY, 1), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1.2, 18, 2.5] }} />
      {/* The Arianne line (the guideline laid in the cave): its own drawing,
          a continuous line in its own colour over the walls. */}
      <Layer id="oc-caves-arianne-halo" source-layer="passages" type="line" filter={filter(kind('arianne'))} layout={{ visibility, 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(DARK_HALO, DARK_HALO), 'line-opacity': ifHidden(HIDDEN_OPACITY * HALO_OPACITY, HALO_OPACITY), 'line-blur': 1, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 18, 4.5] }} />
      <Layer id="oc-caves-arianne" source-layer="passages" type="line" filter={filter(kind('arianne'))} layout={{ visibility, 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': ifHidden(HIDDEN_COLOR, CAVE_LAYER.ARIANNE_COLOR), 'line-opacity': ifHidden(HIDDEN_OPACITY, 1), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.4, 18, 2.5] }} />
      <Layer id="oc-caves-entrances" source-layer="symbols" type="circle" filter={filter(type('entrance'))} layout={{ visibility }}
        paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 5], 'circle-color': ifHidden(HIDDEN_COLOR, theme.palette.info.main), 'circle-opacity': ifHidden(HIDDEN_OPACITY, 1), 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-stroke-opacity': ifHidden(HIDDEN_OPACITY, 1) }} />
      <Layer id="oc-caves-depths" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(type('depth'))}
        layout={{ visibility, 'text-field': units === 'imperial' ? ['concat', ['to-string', ['round', ['/', ['get', 'value'], METRES_PER_FOOT]]], ' ft'] : ['concat', ['to-string', ['get', 'value']], ' m'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 11 }}
        paint={{ 'text-color': '#fff', 'text-opacity': ifHidden(HIDDEN_OPACITY, 1), 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1.2 }} />
      <Layer id="oc-caves-names" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(['in', ['get', 'type'], ['literal', ['place-name', 'leads-to']]])}
        layout={{ visibility, 'text-field': ['coalesce', ['get', 'label'], ['get', 'name']], 'text-font': ['DIN Pro Italic', 'Arial Unicode MS Regular'], 'text-size': 11 }}
        paint={{ 'text-color': '#fff', 'text-opacity': ifHidden(HIDDEN_OPACITY, 1), 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1.2 }} />
      <Layer id="oc-caves-flow" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(type('flow'))}
        layout={{ visibility, 'text-field': '➜', 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-size': 16, 'text-rotate': ['-', ['get', 'bearing'], 90], 'text-rotation-alignment': 'map', 'text-allow-overlap': true }}
        paint={{ 'text-color': ifHidden(HIDDEN_COLOR, theme.palette.info.light), 'text-opacity': ifHidden(HIDDEN_OPACITY, 1), 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1 }} />
      {editMode && (
        <Layer id="oc-caves-edit-outline" source-layer="passages" type="line" filter={['all', ['in', ['get', 'map'], ['literal', outlined]], ['!=', ['get', 'kind'], 'water'], ...shown]}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': theme.palette.warning.light, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 18, 4] }} />
      )}
      {editMode && hovered && !picked && (
        <Popup className="oc-cave-layer-edit-hover" longitude={hovered.lngLat.lng} latitude={hovered.lngLat.lat} closeButton={false} closeOnClick={false} anchor="bottom" offset={12}>
          <Typography variant="body2">
            {maps[hovered.name]?.title}
            {hiddenMaps.includes(hovered.name) && ` (${t('hiddenTag')})`}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {maps[hovered.name]?.date || t('undated')}
          </Typography>
        </Popup>
      )}
      {editMode && picked && (
        <Popup className="oc-cave-layer-edit-card" longitude={picked.lngLat.lng} latitude={picked.lngLat.lat} closeButton={false} closeOnClick={false} onClose={() => setPicked(null)} anchor="bottom" offset={12} maxWidth="300px">
          <EditCard map={maps[picked.name]} hidden={hiddenMaps.includes(picked.name)} sistemaName={sistemaName} onHide={() => setPickedHidden(true)} onShow={() => setPickedHidden(false)} onClose={() => setPicked(null)} />
        </Popup>
      )}
    </Source>
  )
}
