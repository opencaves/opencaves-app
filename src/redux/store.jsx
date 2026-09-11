import { configureStore, combineReducers } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import appReducer from './slices/appSlice.jsx'
import dataReducer from './slices/dataSlice.jsx'
import sessionReducer from './slices/sessionSlice.jsx'
import searchReducer from './slices/searchSlice.jsx'
import mapSlice from './slices/mapSlice.jsx'

const persistStorage = localforage.createInstance({
  name: 'OpenCaves',
})

const sessionPersistStorage = {
  getItem: (key) => Promise.resolve(window.sessionStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(window.sessionStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(window.sessionStorage.removeItem(key)),
}

const rootPersistConfig = {
  key: 'root',
  storage: persistStorage,
  blacklist: ['navigation', 'map', 'app', 'session'],
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
  storage: persistStorage,
  blacklist: ['currentMarker'],
}

const rootReducer = combineReducers({
  app: persistReducer(appPersistConfig, appReducer),
  session: persistReducer(sessionPersistConfig, sessionReducer),
  search: searchReducer,
  // map: persistReducer(mapPersistConfig, mapReducer),
  map: mapSlice,
  data: dataReducer,
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
