import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  aboutDialogOpen: false,
  filterMenuOpen: false,
  resultPaneSmOpen: true,
  resultPaneSmOpenThreshold: .8,
  resultPaneSmFirstBreakpoint: .25,
  resultPaneSmRestBreakpoints: [.5, 1],
  languages: []
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    toggleAboutDialog: (state, action) => {
      console.log('state.aboutDialogOpen: %o', state.aboutDialogOpen)
      state.aboutDialogOpen = !state.aboutDialogOpen
    },
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
export const { toggleAboutDialog, toggleFilterMenu, setResultPaneSmOpen, setResultPaneSmFirstBreakpoint } = appSlice.actions

export default appSlice.reducer