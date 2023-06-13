import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  resultPaneSmOpen: true,
  resultPaneSmFirstBreakpoint: .25,
  resultPaneSmRestBreakpoints: [.5, 1]
}

export const appSlice = createSlice({
  name: 'app',
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
    setResultPaneSmOpen: (state, action) => {
      state.resultPaneSmOpen = action.payload
    },
    setResultPaneSmFirstBreakpoint: (state, action) => {
      state.resultPaneSmFirstBreakpoint = action.payload
    },
  },
})

// Action creators are generated for each case reducer function
export const { setResultPaneSmOpen, setResultPaneSmFirstBreakpoint } = appSlice.actions

export default appSlice.reducer