import { createSlice } from "@reduxjs/toolkit"

export function buildContinueUrl(location) {
  const baseUrl = `${location.pathname}${location.search}`

  if (/^\/map\/[^/]+$/.test(location.pathname)) {
    return baseUrl
  }

  return `${baseUrl}${location.hash}`
}

const initialState = {
  user: null,
  isLoggedIn: false,
  isAnonymous: false,
  continueUrl: null,
  roles: [],
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
      state.isLoggedIn = !!action.payload && !action.payload.isAnonymous
      state.isAnonymous = !!action.payload?.isAnonymous
      if (!action.payload) {
        state.roles = []
      }
    },
    setUserRoles: (state, action) => {
      state.roles = action.payload || []
    },
    setContinueUrl: (state, action) => {
      state.continueUrl = action.payload
    },
    deleteContinueUrl: (state) => {
      state.continueUrl = null
    }
  }
})

export const { setUser, setUserRoles, setContinueUrl, deleteContinueUrl } = sessionSlice.actions
export default sessionSlice.reducer