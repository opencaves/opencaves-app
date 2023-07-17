import { getCaveData } from './data-service/dataImporter'
import { processData } from './data-service/dataProcessor'
import { store } from '../redux/store'
import { setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources, setExpires, setLanguages } from '../redux/slices/dataSlice'


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

export function getData() {
  return new Promise((resolve, reject) => {
    console.log('[getData] getting data...')
    function doGetData() {
      fetchCaveData()
        .then(data => {
          // console.log('[getData] fetched data: %o', data)
          // setCaves(toGeojson(data.caves))
          handleSetCaves(data)
          console.log('[getData] returning data from fetch')
          resolve()

          // setgeoJson(toGeojson(data.caves))
        })
        .catch(error => {
          console.error('[getData] %o', error)
          reject(error)
        })
    }

    if (store.getState().data.caves.length === 0) {
      doGetData()
    } else {
      console.log('[getData] returning data from store')
      const expires = store.getState().data.expires
      const now = Date.now()
      if (expires && expires < now) {
        console.log('[getData] data expired. Fetching again...')
        doGetData()
      }
      resolve()
    }
  })
}

async function fetchCaveData() {
  return getCaveData().then((data) => {
    // console.log('[fetchCaveData] raw data: %o', data)
    data = processData(data)

    const bounds = {
      minLongitude: 180,
      maxLongitude: -180,
      minLatitude: 90,
      maxLatitude: -90
    }
    // console.log('[fetchCaveData] processed data: %o', data)
    data.caves.filter(c => c.location).forEach(cave => {
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
  })
}
