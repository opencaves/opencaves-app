import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  viewState: {},
  // showPopup: false,
  popupData: {},
  currentCave: null,
  currentZoomLevel: 14,
  data: [],
  dataStats: {},
  filteredData: [],
  filteredDataTotals: {},
  // Cross-component coordinate picking: the cave edit form (rendered inside
  // ResultPane) sets which field it wants next, Map.jsx's own click handler
  // (a sibling component, not a child) fills it in on the next map click.
  pickingCoordinateFor: null, // 'location' | 'entrance' | null
  pickedCoordinate: null, // { field, longitude, latitude } | null
  // Live mirror of the edit form's own (possibly unsaved) location/entrance
  // values, keyed by field name, so Map.jsx can render a pin for each
  // populated field without waiting for a save.
  editFieldCoordinates: {}, // { [field]: { longitude, latitude } }
  // A CoordinateField's own "center the map here" action - Map.jsx flies
  // there and clears this once it has.
  flyToCoordinateRequest: null, // { longitude, latitude } | null
}

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    // Redux Toolkit allows us to write "mutating" logic in reducers. It
    // doesn't actually mutate the state because it uses the Immer library,
    // which detects changes to a "draft state" and produces a brand new
    // immutable state based off those changes
    setViewState: (state, action) => {
      state.viewState = action.payload
    },
    // setShowPopup: (state, action) => {
    //   state.showPopup = action.payload
    // },
    setPopupData: (state, action) => {
      state.popupData = action.payload
    },
    setCurrentCave: (state, action) => {
      state.currentCave = action.payload
    },
    clearCurrentCave: (state) => {
      state.currentCave = null
    },
    setMapData: (state, action) => {
      state.data = action.payload

      const props = [
        'location.validity',
        'access',
        'accessibility',
        'area'
      ]

      const results = new Map()

      action.payload.forEach(item => {
        for (let prop of props) {
          if (!results.has(prop)) {
            results.set(prop, {})
          }

          let obj = item
          const r = results.get(prop)

          const [propPathA, propPathB] = prop.split('.')
          if (propPathB) {
            obj = obj[propPathA]
            prop = propPathB
          }

          const value = Reflect.has(obj, prop) ? obj[prop] : 'unknown'

          if (!Reflect.has(r, value)) {
            r[value] = 0
          }

          r[value]++
        }

      })

      results.forEach((value, key) => {
        state.dataStats[key] = value
      })

    },
    setFilteredData: (state, action) => {
      state.filteredData = action.payload
    },
    setPickingCoordinateFor: (state, action) => {
      state.pickingCoordinateFor = action.payload
    },
    setPickedCoordinate: (state, action) => {
      state.pickedCoordinate = action.payload
      state.pickingCoordinateFor = null
    },
    clearPickedCoordinate: (state) => {
      state.pickedCoordinate = null
    },
    setEditFieldCoordinate: (state, action) => {
      const { field, longitude, latitude } = action.payload
      state.editFieldCoordinates[field] = { longitude, latitude }
    },
    clearEditFieldCoordinate: (state, action) => {
      delete state.editFieldCoordinates[action.payload]
    },
    clearAllEditFieldCoordinates: (state) => {
      state.editFieldCoordinates = {}
    },
    requestFlyToCoordinate: (state, action) => {
      state.flyToCoordinateRequest = action.payload
    },
    clearFlyToCoordinateRequest: (state) => {
      state.flyToCoordinateRequest = null
    }
  },
})

// Action creators are generated for each case reducer function
export const { setViewState, /* setShowPopup, */ setPopupData, setCurrentCave, clearCurrentCave, setMapData, setFilteredData, setPickingCoordinateFor, setPickedCoordinate, clearPickedCoordinate, setEditFieldCoordinate, clearEditFieldCoordinate, clearAllEditFieldCoordinates, requestFlyToCoordinate, clearFlyToCoordinateRequest } = mapSlice.actions

export default mapSlice.reducer