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