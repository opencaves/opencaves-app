import { createSlice } from '@reduxjs/toolkit'

export function isMapPath(pathname) {
  return /^\/map(?:\/[^/]+)?$/.test(pathname)
}

export function buildContinueUrl(location) {
  const baseUrl = `${location.pathname}${location.search}`

  if (isMapPath(location.pathname)) {
    return `${baseUrl}${location.hash}`
  }

  return baseUrl
}

const initialState = {
  user: null,
  isLoggedIn: false,
  isAnonymous: false,
  continueUrl: null,
  roles: [],
  // False until Firebase Auth has reported the restored session once. The
  // session slice isn't persisted, so until then a signed-in user looks
  // signed out - route guards wait for this rather than redirect.
  authResolved: false,
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.authResolved = true
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
    },
  },
})

export const { setUser, setUserRoles, setContinueUrl, deleteContinueUrl } = sessionSlice.actions
export default sessionSlice.reducer
