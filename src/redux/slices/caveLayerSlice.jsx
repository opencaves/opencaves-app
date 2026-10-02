import { createSlice } from '@reduxjs/toolkit'

// The cave layer's options (the map's layer button, CaveLayerButton), kept
// between visits (persisted with the root state):
// - visible: the passages traced from the cave maps shown or not;
// - scope: 'all' systems, or only the 'selected' cenote's system (with the
//   systems merged into it);
// - colorBySistema: each system in its colour, or all in one colour;
// - editMode: editors only - the map under the pointer highlighted and named,
//   a click to hide its drawing (for everyone).
const initialState = {
  visible: true,
  scope: 'all',
  colorBySistema: true,
  editMode: false,
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
    setCaveLayerEditMode: (state, action) => {
      state.editMode = action.payload
    },
  },
})

export const { setCaveLayerVisible, setCaveLayerScope, setCaveLayerColorBySistema, setCaveLayerEditMode } = caveLayerSlice.actions

export default caveLayerSlice.reducer
