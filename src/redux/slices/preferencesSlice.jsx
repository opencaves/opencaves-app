import { createSlice } from '@reduxjs/toolkit'

// A person's display preferences, kept on this device (persisted with the
// root state) and, for a signed-in account, in users/{uid} (see
// services/unitsPreference.js):
// - units: 'auto', 'metric' or 'imperial' (utils/units.js).
const initialState = {
  units: 'auto',
}

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setUnits: (state, action) => {
      state.units = action.payload
    },
  },
})

export const { setUnits } = preferencesSlice.actions

export default preferencesSlice.reducer
