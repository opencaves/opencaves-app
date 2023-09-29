import { createSlice } from '@reduxjs/toolkit'
import { appTitle } from '@/config/app'
import { paneBreakpoints } from '@/config/resultPane'

const initialState = {
  // name: "Open Caves",
  title: appTitle,
  searchBarOff: false,
  filterMenuOpen: false,
  resultPaneSmOpen: true,
  resultPaneSmInitialBreakpoint: paneBreakpoints[0]
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTitle: (state, action) => {
      state.title = action.payload
    },
    setSearchBarOff(state, action) {
      state.searchBarOff = action.payload
    },
    toggleFilterMenu: (state, action) => {
      state.filterMenuOpen = action.payload
    },
    setResultPaneSmOpen: (state, action) => {
      state.resultPaneSmOpen = action.payload
    },
    setResultPaneSmInitialBreakpoint: (state, action) => {
      state.resultPaneSmInitialBreakpoint = action.payload
    }
  },
})

// Action creators are generated for each case reducer function
export const { setTitle, setSearchBarOff, toggleFilterMenu, setResultPaneSmOpen, setResultPaneSmInitialBreakpoint } = appSlice.actions

export default appSlice.reducer