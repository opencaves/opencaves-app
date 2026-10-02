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
}

const sessionPersistConfig = {
  key: 'session',
  storage: sessionPersistStorage,
}

const mapPersistConfig = {
  key: 'map',
  storage: sessionPersistStorage,
  // placeOnMap and crossPickFor are transient UI modes - restoring them after
  // a reload would strand them with nothing driving them.
  blacklist: ['currentMarker', 'placeOnMap', 'crossPickFor'],
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
  devTools: import.meta.env.DEV,
  middleware: (getDefaultMiddleware) => {
    const defaultMiddlewares = getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })

    return defaultMiddlewares
  },
})

export const persistor = persistStore(store)
