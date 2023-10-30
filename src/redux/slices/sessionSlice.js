import { createSlice } from "@reduxjs/toolkit"

const initialState = {
  user: null,
  isLoggedIn: false,
  isAnonymous: false,
  continueUrl: null,
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
      state.isLoggedIn = !!action.payload && !action.payload.isAnonymous
      state.isAnonymous = !!action.payload?.isAnonymous
    },
    setContinueUrl: (state, action) => {
      state.continueUrl = action.payload
    },
    deleteContinueUrl: (state) => {
      state.continueUrl = null
    }
  }
})

export const { setUser, setContinueUrl, deleteContinueUrl } = sessionSlice.actions
export default sessionSlice.reducer