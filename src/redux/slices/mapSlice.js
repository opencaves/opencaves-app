import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  mapProps: {
    attributionControl: false,
    hash: false,
    mapStyle: 'mapbox://styles/remillc/clg9w4w1500fc01pphp0b039e',
    // reuseMaps: true,
  },
  initialViewState: {
    latitude: 20.196112,
    longitude: -87.4868895,
    zoom: 10
  },
  viewState: {},
  showPopup: false,
  popupData: {},
  currentCaveId: null,
  currentCave: null,
  data: [],
  dataStats: {},
  filteredData: [],
  filteredDataTotals: {}
}

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    // Redux Toolkit allows us to write "mutating" logic in reducers. It
    // doesn't actually mutate the state because it uses the Immer library,
    // which detects changes to a "draft state" and produces a brand new
    // immutable state based off those changes
    setInitialViewState: (state, action) => {
      state.initialViewState = action.payload
    },
    setViewState: (state, action) => {
      state.viewState = action.payload
    },
    setShowPopup: (state, action) => {
      state.showPopup = action.payload
    },
    setPopupData: (state, action) => {
      state.popupData = action.payload
    },
    setCurrentCaveId: (state, action) => {
      state.currentCaveId = action.payload
    },
    setCurrentCave: (state, action) => {
      state.currentCave = action.payload
    },
    setData: (state, action) => {
      state.data = action.payload

      const props = [
        'location.valid',
        'access',
        'accessibility'
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

          const value = Reflect.has(obj, prop) ? obj[prop] : '_unknown'

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
    }
  },
})

// Action creators are generated for each case reducer function
export const { setInitialViewState, setViewState, setShowPopup, setPopupData, setCurrentCaveId, setCurrentCave, setData, setFilteredData } = mapSlice.actions

export default mapSlice.reducer