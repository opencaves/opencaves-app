import { createSlice } from '@reduxjs/toolkit'
import { appTitle, paneInitialBreakpoint } from '@/config/app'
import { paneBreakpoints } from '@/config/app'

const initialState = {
  // name: "Open Caves",
  title: appTitle,
  searchBarOff: false,
  filterMenuOpen: false,
  resultPaneSmOpen: true,
  resultPaneSmCurrentBreakpoint: paneInitialBreakpoint
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
    setResultPaneSmCurrentBreakpoint: (state, action) => {
      state.resultPaneSmCurrentBreakpoint = action.payload
    }
  },
})

// Action creators are generated for each case reducer function
export const { setTitle, setSearchBarOff, toggleFilterMenu, setResultPaneSmOpen, setResultPaneSmCurrentBreakpoint } = appSlice.actions

export default appSlice.reducer