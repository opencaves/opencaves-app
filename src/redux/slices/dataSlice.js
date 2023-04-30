import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  accesses: [],
  accessibilities: [],
  areas: [],
  caves: [],
  colors: [],
  connections: [],
  sistemas: [],
  sources: []
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
    }
  },
})

// Action creators are generated for each case reducer function
// export const { setCoordinateValid } = filterSlice.actions
export const { setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources } = dataSlice.actions

export default dataSlice.reducer