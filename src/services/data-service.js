import { getCaveData } from './dataImporter'
import { processData } from './dataProcessor'
import { store } from '../redux/store'
import { setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources } from '../redux/slices/dataSlice'
import { setData } from '../redux/slices/mapSlice'


function handleSetCaves(data) {
  store.dispatch(setAccesses(data.accesses))
  store.dispatch(setAccessibilities(data.accessibilities))
  store.dispatch(setAreas(data.areas))
  store.dispatch(setCaves(data.caves))
  store.dispatch(setColors(data.colors))
  store.dispatch(setConnections(data.connections))
  store.dispatch(setSistemas(data.sistemas))
  store.dispatch(setSources(data.sources))
  store.dispatch(setData(data.caves?.filter(c => c.location)))
}

export function getData() {
  return new Promise((resolve, reject) => {
    if (store.getState().data.caves.length === 0) {
      fetchCaveData()
        .then(data => {
          console.log('[getData] fetched data: %o', data)
          // setCaves(toGeojson(data.caves))
          handleSetCaves(data)
          console.log('[getData] returning data from fetch')
          resolve()

          // setgeoJson(toGeojson(data.caves))
        })
        .catch(reject)
    } else {
      console.log('[getData] returning data from store')
      resolve()
    }
  })
}

async function fetchCaveData() {
  return getCaveData().then((data) => {
    console.log('[fetchCaveData] raw data: %o', data)
    data = processData(data)

    const bounds = {
      minLongitude: 180,
      maxLongitude: -180,
      minLatitude: 90,
      maxLatitude: -90
    }
    console.log('[fetchCaveData] processed data: %o', data)
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
    console.log('bounds: ', bounds)

    data.bounds = bounds

    return data
  })
}
