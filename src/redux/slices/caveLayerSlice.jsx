import { createSlice } from '@reduxjs/toolkit'

// The cave layer's options (the map's layer button, CaveLayerButton), kept
// between visits (persisted with the root state):
// - visible: the passages traced from the cave maps shown or not;
// - scope: 'all' systems, or only the 'selected' cenote's system (with the
//   systems merged into it);
// - colorBySistema: each system in its colour, or all in one colour;
// - year: the systems as they were that year - connections made later not
//   applied yet (a system merged since shows as its own) - or null for today.
const initialState = {
  visible: true,
  scope: 'all',
  colorBySistema: true,
  year: null,
}

export const caveLayerSlice = createSlice({
  name: 'caveLayer',
  initialState,
  reducers: {
    setCaveLayerVisible: (state, action) => {
      state.visible = action.payload
    },
    setCaveLayerScope: (state, action) => {
      state.scope = action.payload
    },
    setCaveLayerColorBySistema: (state, action) => {
      state.colorBySistema = action.payload
    },
    setCaveLayerYear: (state, action) => {
      state.year = action.payload
    },
  },
})

export const { setCaveLayerVisible, setCaveLayerScope, setCaveLayerColorBySistema, setCaveLayerYear } = caveLayerSlice.actions

export default caveLayerSlice.reducer
