import { configureStore, combineReducers } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { createMigrate, persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import appReducer from './slices/appSlice.jsx'
import dataReducer from './slices/dataSlice.jsx'
import sessionReducer from './slices/sessionSlice.jsx'
import searchReducer from './slices/searchSlice.jsx'
import mapSlice from './slices/mapSlice.jsx'
import caveLayerReducer from './slices/caveLayerSlice.jsx'
import preferencesReducer from './slices/preferencesSlice.jsx'

const persistStorage = localforage.createInstance({
  name: 'OpenCaves',
})

const sessionPersistStorage = {
  getItem: (key) => Promise.resolve(window.sessionStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(window.sessionStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(window.sessionStorage.removeItem(key)),
}

// Changes to what was kept in a browser, applied once when it's loaded.
const rootMigrations = {
  // The cave layer is off by default now: off again for everyone who had it
  // on only because it used to be on by default.
  1: (state) => (state?.caveLayer ? { ...state, caveLayer: { ...state.caveLayer, visible: false } } : state),
}

const rootPersistConfig = {
  key: 'root',
  version: 1,
  storage: persistStorage,
  blacklist: ['navigation', 'map', 'app', 'session'],
  migrate: createMigrate(rootMigrations, { debug: false }),
}

const appPersistConfig = {
  key: 'app',
  storage: sessionPersistStorage,
  // searchBarOff follows the phone sheet live: restored after a reload with
  // no sheet to clear it, it kept the search bar hidden.
  blacklist: ['searchBarOff'],
}

const sessionPersistConfig = {
  key: 'session',
  storage: sessionPersistStorage,
}

const mapPersistConfig = {
  key: 'map',
  storage: sessionPersistStorage,
  // placeOnMap and crossPickFor are transient UI modes - restoring them after
  // a reload would strand them with nothing driving them. data is every
  // located cave, rebuilt from the cave data on each load (Map.jsx): kept, its
  // ~300 KB were rewritten to sessionStorage on every change to this slice -
  // a cave picked, the map panned - long enough to make the camera's flight jump.
  blacklist: ['currentMarker', 'placeOnMap', 'crossPickFor', 'viewResetRequested', 'data'],
}

const rootReducer = combineReducers({
  app: persistReducer(appPersistConfig, appReducer),
  session: persistReducer(sessionPersistConfig, sessionReducer),
  search: searchReducer,
  map: persistReducer(mapPersistConfig, mapSlice),
  data: dataReducer,
  caveLayer: caveLayerReducer,
  preferences: preferencesReducer,
})

const persistedReducer = persistReducer(rootPersistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  // A page the server rendered (entry-server.jsx): the state it was rendered
  // with (the app's title), so the app's first render is the server's
  // (hydration). Its cave data stays out of the store (useCaveData).
  preloadedState: window.__OC_SSR__?.state,
  devTools: import.meta.env.DEV,
  middleware: (getDefaultMiddleware) => {
    const defaultMiddlewares = getDefaultMiddleware({
      // Development only. The datasets from Firestore (every cave, sistema,
      // connection...) are replaced whole, never changed in place: walking
      // them on every action took ~50ms ("ImmutableStateInvariantMiddleware
      // took 47ms"). The serializable check still covers them - it caught
      // Firestore Timestamps stored in them.
      immutableCheck: {
        ignoredPaths: ['map.data', 'data'],
      },
      // Nor are the datasets checked here (as in immutableCheck): walking
      // them took ~45ms on every action.
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ['map.data', 'data'],
      },
    })

    return defaultMiddlewares
  },
})

// On a page the server rendered, the stored state is read once the page is
// hydrated (index.jsx): read before, it would make the first render differ
// from the server's.
export const persistor = persistStore(store, window.__OC_SSR__ ? { manualPersist: true } : undefined)
