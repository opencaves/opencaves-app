import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  dataLoadingState: {
    state: 'loading'
  },
  expires: null,
  maxAge: 24 * 60 * 60, // 1 day, in seconds
  // maxAge: 10,
  accesses: [],
  accessibilities: [],
  areas: [],
  caves: [],
  colors: [],
  connections: [],
  sistemas: [],
  sources: [],
  languages: []
}

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    // Redux Toolkit allows us to write "mutating" logic in reducers. It
    // doesn't actually mutate the state because it uses the Immer library,
    // which detects changes to a "draft state" and produces a brand new
    // immutable state based off those changes
    // setData: (state, action) => {
    //   console.log('state: %o', state)
    //   console.log('action: %o', action)
    //   state[action.payload.name] = action.payload.data
    // },
    setDataLoadingState: (state, action) => {
      state.dataLoadingState = action.payload
    },
    setAccesses: (state, action) => {
      state.accesses = action.payload
    },
    setAccessibilities: (state, action) => {
      state.accessibilities = action.payload
    },
    setAreas: (state, action) => {
      state.areas = action.payload
    },
    setCaves: (state, action) => {
      state.caves = action.payload
    },
    setColors: (state, action) => {
      state.colors = action.payload
    },
    setConnections: (state, action) => {
      state.connections = action.payload
    },
    setSistemas: (state, action) => {
      state.sistemas = action.payload
    },
    setSources: (state, action) => {
      state.sources = action.payload
    },
    setExpires: (state) => {
      state.expires = Date.now() + state.maxAge
    },
    setLanguages: (state, action) => {
      state.languages = action.payload
    }
  },
})

// Action creators are generated for each case reducer function
// export const { setCoordinateValid } = filterSlice.actions
export const { setDataLoadingState, setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources, setExpires, setLanguages } = dataSlice.actions

export default dataSlice.reducer