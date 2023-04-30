import { getCaveData } from './dataImporter'
import { processData } from './dataProcessor'
import { store } from '../redux/store'
import { setAccesses, setAccessibilities, setAreas, setCaves, setColors, setConnections, setSistemas, setSources } from '../redux/slices/dataSlice'
import { setData } from '../redux/slices/mapSlice'

// export const db = {
//   caves: new PouchDB('caves')
// };
// console.log('###');
// db.caves
//   .info()
//   .then(async (details) => {
//     console.log('then...');
//     if (details.doc_count == 0 && details.update_seq == 0) {
//       console.log('database does not exist');
//       try {
//         const data = await fetchCaveData();
//         console.log(data);
//       } catch (error) {
//         console.log(error);
//       }
//     }
//   })
//   .catch(function (err) {
//     console.log('error: ' + err);
//     return;
//   });

// export const db = await fetchCaveData();


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
  if (store.getState().data.caves.length === 0) {
    fetchCaveData()
      .then(data => {
        console.log(data)
        // setCaves(toGeojson(data.caves))
        handleSetCaves(data)

        // setgeoJson(toGeojson(data.caves))
      })
  }
}

async function fetchCaveData() {
  return getCaveData().then((data) => {
    console.log(data)
    data = processData(data)

    const bounds = {
      minLongitude: 180,
      maxLongitude: -180,
      minLatitude: 90,
      maxLatitude: -90
    }
    console.log('data: %o', data)
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
