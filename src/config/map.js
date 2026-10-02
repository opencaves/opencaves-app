export const SISTEMA_DEFAULT_COLOR = '#fff'

// Coordinates are stored and shown with 5 decimals (about 1m).
export const COORDINATE_DECIMALS = 5

// The region the app covers - the Yucatán peninsula - as [west, south, east,
// north]: e.g. what place searches are limited to (MapPlaceSearch).
export const REGION_BBOX = [-92.5, 17.5, -86.5, 21.8]

// How close "Place on map" zooms in on the field's point (or the cave):
// enough to place a cave entrance precisely. Both placing modes
// (CoordinatesMapPreview, PlaceOnMapOverlay).
export const PLACE_ZOOM = 17

export const INITIAL_VIEW_STATE = {
  latitude: 20.196112,
  longitude: -87.4868895,
  zoom: 10
}
export const MAP_PROPS = {
  attributionControl: false,
  // No `hash`: Map.jsx syncs the URL hash itself, on map pages only (see
  // location-view-state.js).
  mapStyle: 'mapbox://styles/remillc/clg9w4w1500fc01pphp0b039e',
  // reuseMaps: true,
  dragRotate: false,
  useWebGL2: true
}

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
  // The maps in the tiles: name -> { title, sistemaId } (build-tiles.js).
  MAPS: '/tiles/caves/maps.json',
  // The layer's settings shared by everyone (Firestore): { hiddenMaps: [name] }.
  SETTINGS_DOC: 'settings/caveLayer',
  MIN_ZOOM: 10,
  MAX_ZOOM: 18,
  DETAIL_ZOOM: 15,
  SYMBOL_ZOOM: 16,
  // Water: the blue the map reviews used (overlay_scan.py), the same in every system.
  WATER_COLOR: '#9ec3d6',
  WATER_OPACITY: 0.55,
}
