import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Map, { Marker, Popup, GeolocateControl } from 'react-map-gl'
import { useMediaQuery } from 'react-responsive'
import { chain } from 'underscore'
import { setShowPopup, setPopupData, setViewState, setCurrentMarker, setCurrentCaveId, setCurrentCave } from '../redux/slices/mapSlice'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import { useIonRouter } from '@ionic/react'
/// app.js

function toGeojson(data) {
  return {
    type: 'FeatureCollection',
    features: data.filter(c => c.location).map(c => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [c.location.lng, c.location.lat]
        },
        properties: c
      }
    })
  }
}

export default function OCMap() {

  const mapProps = useSelector(state => state.map.mapProps)
  const showPopup = useSelector(state => state.map.showPopup)
  const popupData = useSelector(state => state.map.popupData)
  const searchOptions = useSelector(state => state.search)
  const currentMarker = useSelector(state => state.map.currentMarker)
  const [zoomLevel, setZoomLevel] = useState(mapProps.initialViewState.zoom)

  const mapRef = useRef()

  const router = useIonRouter()
  console.log('route info: %o', router.routeInfo)

  const dispatch = useDispatch()

  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

  const data = useSelector(state => state.map.data)

  // const caves = useSelector(state => filterCaves(state.map.data, filters))
  const caves = useMemo(() => {

    const filters = {
      coordinates: [
        cave => searchOptions.showValidCoordinates && Reflect.has(cave.location, 'valid') && cave.location.valid,
        cave => searchOptions.showInvalidCoordinates && Reflect.has(cave.location, 'valid') && !cave.location.valid,
        cave => searchOptions.showUnknownCoordinates && !Reflect.has(cave.location, 'valid'),
      ],
      accesses: [
        cave => {
          return searchOptions.showAccesses.some(access => {
            return (access.key === '_unknown' ? !Reflect.has(cave, 'access') : access.key === cave.access) && access.checked
          })
        },
      ],
      accessibilities: [
        cave => {
          return searchOptions.showAccessibilities.some(accessibility => {
            return (accessibility.key === '_unknown' ? Reflect.has(cave, 'accessibility') : accessibility.key === cave.accessibility) && accessibility.checked
          })
        }
      ]
    }

    return filterCaves(data, filters)

  }, [data, searchOptions])
  // console.log('[filtered caves] %o', caves)

  // dispatch(setFilteredData(caves))

  function filterCaves(caves, filters) {

    function or(filters) {
      return function iteratee(result, item) {
        if (filters.some(filter => filter(item))) {
          result.push(item)
        }
        return result
      }
    }

    return chain(caves)
      .reduce(or(filters.coordinates), [])
      .reduce(or(filters.accesses), [])
      .value()
  }

  function handleMarkerOnClick(event, cave) {
    // console.log('[handleMarkerOnClick] cave: %o, event: %o', cave, event)

    dispatch(setCurrentCaveId(cave.id))
    dispatch(setCurrentCave(cave))

    const action = router.routeInfo.pathname === '/map' ? 'push' : 'replace'
    console.log('action: %o', action)
    // router[action](`/map/${cave.id}`)
    router.push(`/map/${cave.id}`, 'none', action)

    if (currentMarker) {
      currentMarker.getElement().classList.remove('active')
    }

    event.target.getElement().classList.add('active')

    if (isSmall) {
      // Center around selected marker
      mapRef.current.flyTo({
        center: [cave.location.longitude, cave.location.latitude]
      })
    }

  }

  function onMouseEnter(event) {
    console.log('[onMouseEnter] %o', event)
  }

  const onMove = useCallback(event => {
    // dispatch({ type: 'setViewState', payload: event.viewState })
    dispatch(setViewState(event.viewState))
  }, [])

  function onZoom(event) {
    setZoomLevel(event.viewState.zoom)
  }

  // const markers = useMemo(() => caves?.map(cave => {
  //   // console.log('cave: %o', cave)
  //   return (
  //     <Marker key={cave.id}
  //       longitude={cave.location.longitude}
  //       latitude={cave.location.latitude}
  //       anchor='center'
  //       onClick={(event) => handleMarkerOnClick(event, cave)}>
  //       <div className='marker'>
  //         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="37.534" preserveAspectRatio="xMidYMid" version="1.0" viewBox="0 0 20 28.15" className='marker-icon'><path fill={cave.color} stroke="#23272b" strokeWidth=".6" d="M11.3 25.75c.85-2.475 1.725-3.9 4.576-7.4 1.15-1.426 2.375-3.151 2.7-3.801 2.876-5.726.05-12.202-6.076-13.977C12.163.472 10.527.3 10 .3c-.527 0-2.163.171-2.5.271-6.126 1.776-8.952 8.252-6.076 13.977.325.65 1.55 2.376 2.7 3.801 2.85 3.5 3.726 4.926 4.576 7.401.625 1.875.764 2.097 1.3 2.1.536.003.675-.225 1.3-2.1z" /><path fill="#fff" fillRule="evenodd" d="M5.263 12.689c0-1.184 2.368-4.737 4.709-4.737 2.396 0 4.765 3.553 4.765 4.737H10ZM10 4.399c-3.553 0-8.29 4.737-8.29 8.29h1.184c0-3.553 4.737-7.106 7.106-7.106 2.368 0 7.105 3.553 7.105 7.106h1.185c0-3.553-4.737-8.29-8.29-8.29z" /></svg>
  //         {zoomLevel > 11 && <div className='marker-label'>{cave.name}</div>}
  //       </div>
  //     </Marker >)
  // }
  // ), [caves])

  const layerStyle = {
    id: 'point',
    type: 'symbol',
    source: 'my-data',
    layout: {
      'text-field': ['get', 'name'],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.5,
      'text-justify': 'auto',
      // 'icon-image': ['concat', ['get', 'icon'], '-15']
    }
  }

  function onGeolocateError(error) {
    console.error('[onGeolocateError] %o', error)
  }

  useEffect(() => {
    console.log('fire once: %o', router)
    const pathname = router.routeInfo.pathname
    if (pathname !== '/map') {
      const id = pathname.split('/').pop()
      const currentCave = data.find(cave => cave.id === id)
      if (currentCave) {
        dispatch(setCurrentCaveId(id))
        dispatch(setCurrentCave(currentCave))
      }
    }
  }, [])

  return (
    <div className="component-wrapper" data-zoom-level={zoomLevel}>
      <Map
        ref={mapRef}
        {...mapProps}
        onMove={onMove}
        onZoom={onZoom}
      >
        <GeolocateControl
          positionOptions={{ enableHighAccuracy: true }}
          // trackUserLocation={true}
          position='bottom-right'
          onError={onGeolocateError}
        />
        {showPopup && (
          <Popup longitude={popupData.location?.longitude} latitude={popupData.location?.latitude}
            anchor="bottom"
          // onClose={() => setShowPopup(false)}
          >
            You are here
          </Popup>)}
        {/* <Popup longitude={-87.4901} latitude={20.1885}
          anchor="bottom"
          onClose={() => setShowPopup(false)}>
          You are here
        </Popup> */}
        {
          caves?.map(cave => {
            // console.log('cave: %o', cave)
            return (
              <Marker key={cave.id}
                longitude={cave.location.longitude}
                latitude={cave.location.latitude}
                anchor='center'
                onClick={(event) => handleMarkerOnClick(event, cave)}>
                <div className='marker'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="37.534" preserveAspectRatio="xMidYMid" version="1.0" viewBox="0 0 20 28.15" className='marker-icon'><path fill={cave.color} stroke="#23272b" strokeWidth=".6" d="M11.3 25.75c.85-2.475 1.725-3.9 4.576-7.4 1.15-1.426 2.375-3.151 2.7-3.801 2.876-5.726.05-12.202-6.076-13.977C12.163.472 10.527.3 10 .3c-.527 0-2.163.171-2.5.271-6.126 1.776-8.952 8.252-6.076 13.977.325.65 1.55 2.376 2.7 3.801 2.85 3.5 3.726 4.926 4.576 7.401.625 1.875.764 2.097 1.3 2.1.536.003.675-.225 1.3-2.1z" /><path fill="#fff" fillRule="evenodd" d="M5.263 12.689c0-1.184 2.368-4.737 4.709-4.737 2.396 0 4.765 3.553 4.765 4.737H10ZM10 4.399c-3.553 0-8.29 4.737-8.29 8.29h1.184c0-3.553 4.737-7.106 7.106-7.106 2.368 0 7.105 3.553 7.105 7.106h1.185c0-3.553-4.737-8.29-8.29-8.29z" /></svg>
                  {zoomLevel > 11 && <div className='marker-label'>{cave.name}</div>}
                </div>
              </Marker >)
          }
          )
        }
        {/* <Source id='my-data' type='geojson' data={geoJson}>
          <Layer {...layerStyle} />
        </Source> */}
      </Map>
    </div >
  )
}
