import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Source, Layer } from 'react-map-gl/mapbox'
import { useTheme } from '@mui/material/styles'
import { CAVE_LAYER } from '@/config/map.js'

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

// The year a connection was made ("2011", "2011-04"...), or null when undated.
export const connectionYear = (connection) => (/^\d{4}/.test(connection.connectionDate || '') ? Number(connection.connectionDate.slice(0, 4)) : null)

// Each sistema's top-level sistema (following the connections up), as the
// cave pins use: a system merged into another shows in that one's colour.
// With a year, only the connections made by then (undated ones always).
function rootSistemas(sistemas, connections, year) {
  const made = (c) => year == null || connectionYear(c) == null || connectionYear(c) <= year
  const parent = new Map((connections || []).filter((c) => c.sistemaId && c.parentSistemaId && made(c)).map((c) => [c.sistemaId, c.parentSistemaId]))
  const root = (id, seen = new Set()) => (parent.has(id) && !seen.has(id) ? root(parent.get(id), seen.add(id)) : id)
  return new Map((sistemas || []).map((s) => [s.id, root(s.id)]))
}

// The cave layer: the passages traced from the cave survey maps (walls,
// survey lines, water, drawn details) and their symbols (entrances, depths,
// place names, flow), with the options of the map's layer button (the
// caveLayer slice): shown or not; every system or only the selected cave's
// (selectedSistemaId: its system and the ones merged into it); each system in
// its colour (from the database: a colour changed in the admin UI shows
// without rebuilding the tiles) or all in one colour.
export default function CaveLayer({ selectedSistemaId }) {
  const theme = useTheme()
  const sistemas = useSelector((state) => state.data.sistemas)
  const connections = useSelector((state) => state.data.connections)
  const { visible, scope, colorBySistema, year } = useSelector((state) => state.caveLayer)
  const [ready, setReady] = useState(Boolean(tileIndex))

  useEffect(() => {
    if (!ready) tileIndexLoading.then(() => setReady(true))
  }, [ready])

  const roots = useMemo(() => rootSistemas(sistemas, connections, year), [sistemas, connections, year])
  const single = theme.palette.primary.light
  const color = useMemo(() => {
    const colors = new Map((sistemas || []).map((s) => [s.id, s.color]))
    const pairs = colorBySistema ? [...roots].filter(([, root]) => colors.get(root)).flatMap(([id, root]) => [id, colors.get(root)]) : []
    return pairs.length ? ['match', ['get', 'sistemaId'], ...pairs, single] : single
  }, [sistemas, roots, colorBySistema, single])
  // Only the selected cave's system: every sistema under the same top-level one.
  const sistemaIds = useMemo(() => {
    if (scope !== 'selected' || !selectedSistemaId) return []
    const root = roots.get(selectedSistemaId) || selectedSistemaId
    return [...roots].filter(([, r]) => r === root).map(([id]) => id)
  }, [scope, selectedSistemaId, roots])

  if (!ready) return null
  const visibility = visible ? 'visible' : 'none'
  const only = sistemaIds.length ? [['in', ['get', 'sistemaId'], ['literal', sistemaIds]]] : []
  const filter = (...conditions) => ['all', ...conditions, ...only]
  const kind = (...kinds) => ['in', ['get', 'kind'], ['literal', kinds]]
  const type = (t) => ['==', ['get', 'type'], t]
  const tiles = [new URL(CAVE_LAYER.TILES, window.location.origin).href.replace(/%7B/g, '{').replace(/%7D/g, '}')]

  return (
    <Source id="oc-caves" type="vector" tiles={tiles} minzoom={CAVE_LAYER.MIN_ZOOM} maxzoom={CAVE_LAYER.MAX_ZOOM}>
      <Layer id="oc-caves-water" source-layer="passages" type="fill" filter={filter(kind('water'))} layout={{ visibility }} paint={{ 'fill-color': color, 'fill-opacity': 0.25 }} />
      <Layer id="oc-caves-details" source-layer="passages" type="line" minzoom={CAVE_LAYER.DETAIL_ZOOM} filter={filter(kind('detail'))} layout={{ visibility }}
        paint={{ 'line-color': color, 'line-opacity': 0.6, 'line-width': 0.6 }} />
      <Layer id="oc-caves-walls" source-layer="passages" type="line" filter={filter(kind('wall', 'survey'))} layout={{ visibility, 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1.2, 18, 2.5] }} />
      <Layer id="oc-caves-entrances" source-layer="symbols" type="circle" filter={filter(type('entrance'))} layout={{ visibility }}
        paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 5], 'circle-color': theme.palette.info.main, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 }} />
      <Layer id="oc-caves-depths" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(type('depth'))}
        layout={{ visibility, 'text-field': ['concat', ['to-string', ['get', 'value']], ' m'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 11 }}
        paint={{ 'text-color': '#fff', 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1.2 }} />
      <Layer id="oc-caves-names" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(['in', ['get', 'type'], ['literal', ['place-name', 'leads-to']]])}
        layout={{ visibility, 'text-field': ['coalesce', ['get', 'label'], ['get', 'name']], 'text-font': ['DIN Pro Italic', 'Arial Unicode MS Regular'], 'text-size': 11 }}
        paint={{ 'text-color': '#fff', 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1.2 }} />
      <Layer id="oc-caves-flow" source-layer="symbols" type="symbol" minzoom={CAVE_LAYER.SYMBOL_ZOOM} filter={filter(type('flow'))}
        layout={{ visibility, 'text-field': '➜', 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-size': 16, 'text-rotate': ['-', ['get', 'bearing'], 90], 'text-rotation-alignment': 'map', 'text-allow-overlap': true }}
        paint={{ 'text-color': theme.palette.info.light, 'text-halo-color': 'rgba(0, 0, 0, 0.7)', 'text-halo-width': 1 }} />
    </Source>
  )
}
