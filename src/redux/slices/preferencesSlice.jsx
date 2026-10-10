import { createSlice } from '@reduxjs/toolkit'

// A person's display preferences, kept on this device (persisted with the
// root state) and, for a signed-in account, in users/{uid} (see
// services/unitsPreference.js, services/mapLegendPreference.js):
// - units: 'auto', 'metric' or 'imperial' (utils/units.js);
// - mapLegendOpen: the map legend left open or closed, null until the person
//   first opens or closes it (it then opens on large screens only).
const initialState = {
  units: 'auto',
  mapLegendOpen: null,
}

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setUnits: (state, action) => {
      state.units = action.payload
    },
    setMapLegendOpen: (state, action) => {
      state.mapLegendOpen = action.payload
    },
  },
})

export const { setUnits, setMapLegendOpen } = preferencesSlice.actions

export default preferencesSlice.reducer
