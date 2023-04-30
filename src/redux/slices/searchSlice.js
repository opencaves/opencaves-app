import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  showValidCoordinates: true,
  showInvalidCoordinates: false,
  showUnknownCoordinates: false,
  showAccesses: [
    { key: '_unknown', checked: true },
    { key: "-NTAPlXUWDAFUBCEskCj", checked: true },
    { key: "-NTAPlaC0ALlCGVYHu4t", checked: true },
    { key: "-NTAPlaG7kSC0OCjMNVu", checked: true },
    { key: "-NTAPlaK4HY3T8MAAuLI", checked: true }
  ],
  showAccessibilities: [
    { key: '_unknown', checked: true },
    { key: "-KPZfQEm2QJUXCM1t8zL", checked: true },
    { key: "-KPZfQErMD6m1DQcOsYw", checked: true },
    { key: "-KPZfQF0JsBsYp5lvplz", checked: true },
    { key: "-KPZfQF1l7GK-Am4tL04", checked: true },
    { key: "-NTAZGjJQWc7S39n7s65", checked: true },
    { key: "-NTAaHO_TyB5uc3AigA4", checked: true }
  ]
}

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    // Redux Toolkit allows us to write "mutating" logic in reducers. It
    // doesn't actually mutate the state because it uses the Immer library,
    // which detects changes to a "draft state" and produces a brand new
    // immutable state based off those changes
    setShowValidCoordinates: (state, action) => {
      state.showValidCoordinates = action.payload
    },
    setShowInvalidCoordinates: (state, action) => {
      state.showInvalidCoordinates = action.payload
    },
    setShowUnknownCoordinates: (state, action) => {
      state.showUnknownCoordinates = action.payload
    },
    setShowAccesses: (state, action) => {
      state.showAccesses = action.payload
    },
    setShowAccessibilities: (state, action) => {
      state.showAccessibilities = action.payload
    }
  },
})

// Action creators are generated for each case reducer function
export const { setShowValidCoordinates, setShowInvalidCoordinates, setShowUnknownCoordinates, setShowAccesses, setShowAccessibilities } = searchSlice.actions

export default searchSlice.reducer