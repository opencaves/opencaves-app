import { configureStore, combineReducers } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, } from 'redux-persist'
import sessionStorage from 'redux-persist/lib/storage/session'
import appReducer from './slices/appSlice.jsx'
import dataReducer from './slices/dataSlice.jsx'
import sessionReducer from './slices/sessionSlice.jsx'
import searchReducer from './slices/searchSlice.jsx'
import mapSlice from './slices/mapSlice.jsx'

const persistStorage = localforage.createInstance({
  name: 'OpenCaves'
})

const rootPersistConfig = {
  key: 'root',
  storage: persistStorage,
  blacklist: ['navigation', 'map', 'app', 'session']
}

const appPersistConfig = {
  key: 'app',
  storage: sessionStorage
}

const sessionPersistConfig = {
  key: 'session',
  storage: sessionStorage,
}

const mapPersistConfig = {
  key: 'map',
  storage: persistStorage,
  blacklist: ['currentMarker']
}

const rootReducer = combineReducers({
  app: persistReducer(appPersistConfig, appReducer),
  session: persistReducer(sessionPersistConfig, sessionReducer),
  search: searchReducer,
  // map: persistReducer(mapPersistConfig, mapReducer),
  map: mapSlice,
  data: dataReducer
})

const persistedReducer = persistReducer(rootPersistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: getDefaultMiddleware => {
    const defaultMiddlewares = getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })

    return defaultMiddlewares
  }
})

export const persistor = persistStore(store)