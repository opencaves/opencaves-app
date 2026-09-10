import { createSlice } from '@reduxjs/toolkit'

const initialState = {

  // GPS Coordinates
  showValidCoordinates: true,
  showInvalidCoordinates: false,
  showUnconfirmedCoordinates: false,

  // Areas
  showAreas: [
    { key: "Akumal", checked: true },
    { key: "Boca Paila - Sian Ka'an Biosphere Reserve", checked: true },
    { key: "Chemuyil", checked: true },
    { key: "Coba Road", checked: true },
    { key: "Cozumel Island", checked: true },
    { key: "Isla Alamo", checked: true },
    { key: "Muyil", checked: true },
    { key: "Nohoch Nah Chich", checked: true },
    { key: "Playa Del Carmen North", checked: true },
    { key: "Puerto Aventuras", checked: true },
    { key: "Puerto Morelos", checked: true },
    { key: "Tulum North", checked: true },
    { key: "Tulum South", checked: true },
  ],

  // Accesses
  showAccesses: [
    { key: "yes", checked: true },
    { key: "no", checked: true },
    { key: "customers", checked: true },
    { key: "guide", checked: true },
    { key: "key", checked: true },
    { key: "permission", checked: true },
    { key: 'unknown', checked: true }
  ],

  // Accessibilities
  showAccessibilities: [
    { key: "jungle", checked: true },
    { key: "not-safe", checked: true },
    { key: "sea", checked: true },
    { key: "sidemount-only", checked: true },
    { key: "variable", checked: true },
    { key: "inaccessible", checked: true },
    { key: 'unknown', checked: true }
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
    setShowUnconfirmedCoordinates: (state, action) => {
      state.showUnconfirmedCoordinates = action.payload
    },
    setShowAreas: (state, action) => {
      state.showAreas = action.payload
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
export const { setShowValidCoordinates, setShowInvalidCoordinates, setShowUnconfirmedCoordinates, setShowAreas, setShowAccesses, setShowAccessibilities } = searchSlice.actions

export default searchSlice.reducer