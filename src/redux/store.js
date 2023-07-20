import { configureStore, combineReducers } from '@reduxjs/toolkit'
import localforage from 'localforage'
import sessionStorage from 'redux-persist/lib/storage/session'
import { persistReducer, persistStore } from 'redux-persist'
import thunk from 'redux-thunk'
import appReducer from './slices/appSlice'
import dataReducer from './slices/dataSlice'
import userReducer from "./slices/userSlice"
import searchReducer from './slices/searchSlice'
import mapSlice from './slices/mapSlice'

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
  session: persistReducer(sessionPersistConfig, userReducer),
  search: searchReducer,
  // map: persistReducer(mapPersistConfig, mapReducer),
  map: mapSlice,
  data: dataReducer
})

const persistedReducer = persistReducer(rootPersistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: [thunk]
})

export const persistor = persistStore(store)