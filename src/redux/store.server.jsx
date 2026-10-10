import { configureStore, combineReducers } from '@reduxjs/toolkit'
import appReducer from './slices/appSlice.jsx'
import dataReducer from './slices/dataSlice.jsx'
import sessionReducer from './slices/sessionSlice.jsx'
import searchReducer from './slices/searchSlice.jsx'
import mapSlice from './slices/mapSlice.jsx'
import caveLayerReducer from './slices/caveLayerSlice.jsx'
import preferencesReducer from './slices/preferencesSlice.jsx'

/**
 * The server's store (entry-server.jsx), in place of store.jsx in the server
 * build (vite.config.js): the same slices, without redux-persist (no browser
 * storage on the server). One per rendered page, with that page's data.
 *
 * @param {object} preloadedState
 */
export function createServerStore(preloadedState) {
  return configureStore({
    reducer: combineReducers({
      app: appReducer,
      session: sessionReducer,
      search: searchReducer,
      map: mapSlice,
      data: dataReducer,
      caveLayer: caveLayerReducer,
      preferences: preferencesReducer,
    }),
    preloadedState,
    devTools: false,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
  })
}

// For modules that import the store itself (they use it in event handlers
// and effects, which never run on the server).
export const store = createServerStore()
export const persistor = { persist() {}, purge: async () => {}, flush: async () => {}, pause() {}, subscribe: () => () => {}, getState: () => ({ bootstrapped: true }) }
