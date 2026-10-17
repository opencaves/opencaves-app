import { SETTINGS_COLLECTION } from './collections.js'
// The map's style: one setting, the server's too (its share images' map
// cards, functions/js/share/render.js).
import { MAP_STYLE, REGION_BBOX } from '../../functions/js/constants.js'

export const SISTEMA_DEFAULT_COLOR = '#fff'

// Coordinates are stored and shown with 5 decimals (about 1m).
export const COORDINATE_DECIMALS = 5

// The region the app covers - the Yucatán peninsula - as [west, south, east,
// north]: e.g. what place searches are limited to (MapPlaceSearch), and
// where a cave is a cenote in its page's title (utils/pageTitles.js). One
// setting, the server's too.
export { REGION_BBOX }

// How close "Place on map" zooms in on the field's point (or the cave):
// enough to place a cave entrance precisely. Both placing modes
// (CoordinatesMapPreview, PlaceOnMapOverlay).
export const PLACE_ZOOM = 17

// The map's home area - the Riviera Maya, Puerto Morelos to south of Tulum,
// with a margin - as [west, south, east, north]. The default view (a first
// visit, the nav's Map item) fits the caves inside it (homeBounds.js); a cave
// outside it is ignored there.
export const HOME_AREA_BBOX = [-88.2, 19.6, -86.6, 21.4]

// The view before the caves have loaded (then fitted to them).
export const INITIAL_VIEW_STATE = {
  latitude: 20.196112,
  longitude: -87.4868895,
  zoom: 10
}
export const MAP_PROPS = {
  attributionControl: false,
  // No `hash`: Map.jsx syncs the URL hash itself, on map pages only (see
  // location-view-state.js).
  mapStyle: MAP_STYLE,
  // reuseMaps: true,
  dragRotate: false,
  useWebGL2: true
}

// The map's Measure tool (MeasureTool.jsx): a point put down (or dragged)
// within this many screen pixels of a cave's pin goes on the cave itself -
// about the pin's own size, so a click on the pin snaps.
export const MEASURE_SNAP_RADIUS_PX = 18
// The bottom-right column's room for the ruler button (MeasureButton: 56px,
// 16px above the locate button), which what sits higher in it - the editors'
// edit FAB, the cave layer's legend - adds to their own offset.
export const MEASURE_BUTTON_SLOT = '56px + 16px'
// A segment's length and bearing are labelled at its middle once it's this
// long on screen (shorter, the label - "3.2 km · 135°" - would cover the
// line and its points).
export const MEASURE_LABEL_MIN_PX = 96

export const MARKER_CONFIG = {
  label: {
    minZoomLevel: 11,
  },
  current: {
    label: {
      maxZoomLevel: 14
    }
  }
}
// The cave layer: the passages traced from the cave survey maps, as vector
// tiles built by scripts/map-layer/build-tiles.js (npm run build:tiles) and
// served with the app. Layers "passages" (walls, survey lines, water, drawn
// details) and "symbols" (depths, flow, entrances...); every feature has its
// map and its sistemaId. INDEX lists the tiles that exist (no file for empty
// ones); EMPTY_TILE is what the others are answered with.
export const CAVE_LAYER = {
  TILES: '/tiles/caves/{z}/{x}/{y}.pbf',
  INDEX: '/tiles/caves/index.json',
  EMPTY_TILE: '/tiles/caves/empty.pbf',
  // Its build's version ({ builtAt }): offline copies of its tiles are
  // downloaded again when it changes (offlineMedia.js).
  VERSION: '/tiles/caves/version.json',
  // The maps in the tiles: name -> { title, date, sistemaId } (build-tiles.js).
  MAPS: '/tiles/caves/maps.json',
  // Every map config's map document and state (build-tiles.js): what's not
  // in it is still to process (the Map layers page).
  CONFIGS: '/tiles/caves/configs.json',
  // The layer's settings shared by everyone (Firestore): { hiddenMaps: [name] }.
  SETTINGS_DOC: `${SETTINGS_COLLECTION}/caveLayer`,
  MIN_ZOOM: 10,
  MAX_ZOOM: 18,
  DETAIL_ZOOM: 15,
  SYMBOL_ZOOM: 16,
  // Water: the blue the map reviews used (overlay_scan.py), the same in every system.
  WATER_COLOR: '#9ec3d6',
  WATER_OPACITY: 0.55,
  // The Arianne line (guideline): its own colour, a guideline's yellow.
  ARIANNE_COLOR: '#ffd400',
  // The gold line (the guideline starting in the cavern zone): a deeper gold
  // than the Arianne line, and wider.
  GOLD_LINE_COLOR: '#e0a000',
}
