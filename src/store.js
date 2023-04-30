import { createStore } from 'redux'

function mapStateReducer(state, action) {
  switch (action.type) {
    case 'setViewState':
      return { ...state, viewState: action.payload }

    default:
      return state
  }
}

const defaultMapState = {
  mapStyle: 'mapbox://styles/mapbox/streets-v11',
  viewState: {
    latitude: 20.196112,
    longitude: -87.4868895,
    zoom: 14
  }
}

export default createStore(mapStateReducer, defaultMapState)