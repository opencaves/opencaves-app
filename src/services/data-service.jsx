import { readCaveDataFromFirestore, subscribeToCaveData } from './data-service/firestoreDataReader.js'
import { postProcessCaveData } from './data-service/postProcessCaveData.js'
import { store } from '@/redux/store.jsx'
import { setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources, setExpires, invalidateExpires, setLanguages } from '@/redux/slices/dataSlice'

function handleSetCaves(data) {
  store.dispatch(setAccesses(data.accesses))
  store.dispatch(setAccessibilities(data.accessibilities))
  store.dispatch(setAreas(data.areas))
  store.dispatch(setCaves(data.caves))
  store.dispatch(setColors(data.colors))
  store.dispatch(setConnections(data.connections))
  store.dispatch(setSistemas(data.sistemas))
  store.dispatch(setSources(data.sources))
  store.dispatch(setLanguages(data.languages))
  store.dispatch(setExpires())
}

/**
 * Forces a refetch on the next {@link getData}() call, regardless of the expires
 * cache - used after an admin edit saves, so the map reflects it right away.
 */
export function invalidateData() {
  store.dispatch(invalidateExpires())
}

/**
 * Loads the cave data into the store, unless it's there and not expired.
 *
 * @returns {Promise<void>}
 */
export function getData() {
  return new Promise((resolve, reject) => {
    function doGetData() {
      fetchCaveData()
        .then((data) => {
          handleSetCaves(data)
          resolve()
        })
        .catch((error) => {
          console.error('[getData] %o', error)
          reject(error)
        })
    }

    if (store.getState().data.caves.length === 0) {
      doGetData()
    } else {
      const expires = store.getState().data.expires
      const now = Date.now()
      if (expires === 0 || (expires && expires < now)) {
        doGetData()
      } else {
        resolve()
      }
    }
  })
}

export function subscribeToData(onData, onError) {
  let rendering = null
  const unsubscribe = subscribeToCaveData((rawData) => {
    try {
      const data = processCaveData(rawData)
      // Handing it to the store re-renders the map and its markers,
      // synchronously: a task of its own too, after the processing's.
      clearTimeout(rendering)
      rendering = setTimeout(() => {
        try {
          handleSetCaves(data)
          onData()
        } catch (error) {
          onError(error)
        }
      })
    } catch (error) {
      onError(error)
    }
  }, onError)

  return () => {
    clearTimeout(rendering)
    unsubscribe()
  }
}

function processCaveData(data) {
  // console.log('[fetchCaveData] raw data: %o', data)
  data = postProcessCaveData(data)

  const bounds = {
    minLongitude: 180,
    maxLongitude: -180,
    minLatitude: 90,
    maxLatitude: -90,
  }
  // console.log('[fetchCaveData] processed data: %o', data)
  data.caves
    .filter((c) => c.location)
    .forEach((cave) => {
      // console.log('cave: %o', cave)
      const lng = cave.location.longitude
      const lat = cave.location.latitude

      if (lng < bounds.minLongitude) {
        bounds.minLongitude = lng
      } else {
        if (lng > bounds.maxLongitude) {
          bounds.maxLongitude = lng
        }
      }
      if (lat < bounds.minLatitude) {
        bounds.minLatitude = lat
      } else {
        if (lat > bounds.maxLatitude) {
          bounds.maxLatitude = lat
        }
      }
    })

  data.bounds = bounds

  return data
}

async function fetchCaveData() {
  return processCaveData(await readCaveDataFromFirestore())
}
