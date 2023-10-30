export const SISTEMA_DEFAULT_COLOR = '#fff'
export const initialViewState = {
  latitude: 20.196112,
  longitude: -87.4868895,
  zoom: 10
}
export const mapProps = {
  attributionControl: false,
  hash: true,
  mapStyle: 'mapbox://styles/remillc/clg9w4w1500fc01pphp0b039e',
  // reuseMaps: true,
  dragRotate: false,
  useWebGL2: true
}

export const markerConfig = {
  label: {
    minZoomLevel: 11,
  },
  current: {
    label: {
      maxZoomLevel: 14
    }
  }
}