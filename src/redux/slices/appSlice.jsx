import { createSlice } from '@reduxjs/toolkit'
import { APP_TITLE, PANE_INITIAL_BREAKPOINT } from '@/config/app'
import { PANE_BREAKPOINTS } from '@/config/app'

const initialState = {
  // name: "OpenCaves",
  title: APP_TITLE,
  searchBarOff: false,
  filterMenuOpen: false,
  resultPaneSmOpen: true,
  resultPaneSmCurrentBreakpoint: PANE_INITIAL_BREAKPOINT,
  // The cave the phone sheet's breakpoint is for: a reload of that cave's
  // page opens the sheet where it was (the app slice is kept per tab).
  resultPaneSmCaveId: null,
  // Which of the Pictures/Videos/Maps tabs was last open, per cave - lets a
  // reload of the same cave's pane come back to the tab the person was on.
  caveMediaTabByCaveId: {},
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
    },
    setResultPaneSmCaveId: (state, action) => {
      state.resultPaneSmCaveId = action.payload
    },
    setCaveMediaTab: (state, action) => {
      const { caveId, tab } = action.payload
      state.caveMediaTabByCaveId[caveId] = tab
    },
  },
})

// Action creators are generated for each case reducer function
export const { setTitle, setSearchBarOff, toggleFilterMenu, setResultPaneSmOpen, setResultPaneSmCurrentBreakpoint, setResultPaneSmCaveId, setCaveMediaTab } = appSlice.actions

export default appSlice.reducer