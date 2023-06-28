import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  filterMenuOpen: false,
  resultPaneSmOpen: true,
  resultPaneSmFirstBreakpoint: .25,
  resultPaneSmRestBreakpoints: [.5, 1],
  languages: []
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    toggleFilterMenu: (state, action) => {
      state.filterMenuOpen = action.payload
    },
    setResultPaneSmOpen: (state, action) => {
      state.resultPaneSmOpen = action.payload
    },
    setResultPaneSmFirstBreakpoint: (state, action) => {
      state.resultPaneSmFirstBreakpoint = action.payload
    },
  },
})

// Action creators are generated for each case reducer function
export const { toggleFilterMenu, setResultPaneSmOpen, setResultPaneSmFirstBreakpoint } = appSlice.actions

export default appSlice.reducer