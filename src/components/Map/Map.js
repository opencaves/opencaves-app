import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Map, { Marker, Popup, GeolocateControl } from 'react-map-gl'
import { useMediaQuery } from 'react-responsive'
import { chain, debounce, throttle } from 'underscore'
import { setShowPopup, setPopupData, /* setInitialViewState,*/ setViewState, setCurrentCaveId, setCurrentCave } from '../../redux/slices/mapSlice'
import { MapLoading, MapError } from './MapState'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'
import { useIonRouter } from '@ionic/react'
/// app.js

const defaultDetailedViewZoom = 15

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

  const dataLoadingState = useSelector(state => state.data.dataLoadingState)
  const mapProps = useSelector(state => state.map.mapProps)
  const defaultViewState = useSelector(state => state.map.initialViewState)
  // const initialViewState = useSelector(state => state.map.initialViewState)
  const showPopup = useSelector(state => state.map.showPopup)
  const popupData = useSelector(state => state.map.popupData)
  const searchOptions = useSelector(state => state.search)
  const currentCave = useSelector(state => state.map.currentCave)
  const data = useSelector(state => state.map.data)

  const [mapReady, setMapReady] = useState(false)
  const [currentMarkerElem, doSetCurrentMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(defaultViewState.zoom)
  const [initialViewState, setInitialViewState] = useState(defaultViewState)

  const mapRef = useRef()
  const markersRef = useRef([])

  const router = useIonRouter()

  const dispatch = useDispatch()

  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

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
    console.log('target: %o', event.target)

    setCurrentMarkerElem(event.target.getElement())

    if (isSmall) {
      // Center around selected marker
      mapRef.current.flyTo({
        center: [cave.location.longitude, cave.location.latitude]
      })
    }

  }

  function setCurrentMarkerElem(markerElem, animated = false) {
    if (currentMarkerElem) {
      console.log('currentMarkerElem: %o', currentMarkerElem)
      currentMarkerElem.classList.remove(currentMarkerElem.dataset.activeClass)
      delete currentMarkerElem.dataset.activeClass
    }

    const activeClass = animated ? 'active' : 'active-animated'

    markerElem.classList.add(activeClass)
    markerElem.dataset.activeClass = activeClass
    doSetCurrentMarkerElem(markerElem)
  }

  function onMouseEnter(event) {
    console.log('[onMouseEnter] %o', event)
  }

  // const onMove = useCallback(event => {
  //   console.log('[onMove] event: %o', event)
  //   dispatch(setViewState(event.viewState))
  // }, [])

  const onMove = debounce(function (event) {
    // dispatch({ type: 'setViewState', payload: event.viewState })
    console.log('[onMove] event: %o', event)
    dispatch(setViewState(event.viewState))
  }, 300)

  function onZoom(event) {
    setZoomLevel(event.viewState.zoom)
  }

  function onLoad() {
    if (currentCave) {
      console.log('[onLoad] oui: mapRef %o', mapRef)
      const currentMarkerElem = mapRef.current?.getMap()._markers.find(marker => {
        const markerLngLat = marker.getLngLat()
        const { longitude: lng, latitude: lat } = currentCave.location
        return markerLngLat.lng === lng && markerLngLat.lat === lat
      }).getElement()
      console.log('[onLoad] currentMarkerElem: %o', currentMarkerElem)
      setCurrentMarkerElem(currentMarkerElem, true)
    }
  }

  useEffect(() => {
    console.log('========================================================== loading state: %s', dataLoadingState.state)
  }, [dataLoadingState.state])

  useEffect(() => console.log('========================================================== map ready: %s', mapReady), [mapReady])

  function onGeolocateError(error) {
    console.error('[onGeolocateError] %o', error)
  }

  // initialisation
  useEffect(() => {
    console.log('fire once: %o', router)
    const pathname = router.routeInfo.pathname
    if (pathname !== '/map') {
      const id = pathname.split('/').pop()
      const newCurrentCave = data.find(cave => cave.id === id)
      if (newCurrentCave) {
        console.log('new current cave: %o', newCurrentCave)
        console.log('mapRef: %o', mapRef.current)

        // const currentMarkerElem = markersRef.current.find(marker => marker.key === `m-${currentCave.id}`)
        // console.log('[useEffect] currentMarkerElem: %o', currentMarkerElem)

        const newInitialViewState = {
          longitude: newCurrentCave.location.longitude,
          latitude: newCurrentCave.location.latitude,
          zoom: defaultDetailedViewZoom
        }
        console.log('--- newInitialViewState: %o', newInitialViewState)
        dispatch(setCurrentCaveId(id))
        dispatch(setCurrentCave(newCurrentCave))
        setInitialViewState(newInitialViewState)
        setZoomLevel(newInitialViewState.zoom)
        setMapReady(true)
      }
    }
  }, [data])

  if (dataLoadingState.state === 'error') {
    return (
      <MapError error={dataLoadingState.error} />
    )
  }

  return (
    <div className="component-wrapper" data-zoom-level={zoomLevel} >
      {
        (!mapReady || dataLoadingState.state === 'loading') && (
          // true && (
          <MapLoading />
        )
      }
      {
        mapReady && dataLoadingState.state === 'loaded' && (
          // dataLoadingState.state === 'loaded' && (
          // false && (
          <Map
            ref={mapRef}
            {...mapProps}
            initialViewState={initialViewState}
            onMove={onMove}
            onZoom={onZoom}
            onLoad={onLoad}
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

            {
              caves?.map((cave, i) => {
                // console.log('cave: %o', cave)
                const isCurrentCave = currentCave && currentCave.id === cave.id
                markersRef.current.push(createRef())

                let markerLabel = null

                if (isCurrentCave) {
                  if (zoomLevel < 14) {
                    markerLabel = <div className='marker-label'>{cave.name}</div>
                  }
                } else {
                  if (zoomLevel > 12) {
                    markerLabel = <div className='marker-label'>{cave.name}</div>
                  }
                }

                return (
                  <Marker
                    key={`m-${cave.id}`}
                    longitude={cave.location.longitude}
                    latitude={cave.location.latitude}
                    anchor='center'
                    onClick={(event) => handleMarkerOnClick(event, cave)}>
                    <div className='marker'>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="37.534" preserveAspectRatio="xMidYMid" version="1.0" viewBox="0 0 20 28.15" className='marker-icon'><path fill={cave.color} stroke="#23272b" strokeWidth=".6" d="M11.3 25.75c.85-2.475 1.725-3.9 4.576-7.4 1.15-1.426 2.375-3.151 2.7-3.801 2.876-5.726.05-12.202-6.076-13.977C12.163.472 10.527.3 10 .3c-.527 0-2.163.171-2.5.271-6.126 1.776-8.952 8.252-6.076 13.977.325.65 1.55 2.376 2.7 3.801 2.85 3.5 3.726 4.926 4.576 7.401.625 1.875.764 2.097 1.3 2.1.536.003.675-.225 1.3-2.1z" /><path fill="#fff" fillRule="evenodd" d="M5.263 12.689c0-1.184 2.368-4.737 4.709-4.737 2.396 0 4.765 3.553 4.765 4.737H10ZM10 4.399c-3.553 0-8.29 4.737-8.29 8.29h1.184c0-3.553 4.737-7.106 7.106-7.106 2.368 0 7.105 3.553 7.105 7.106h1.185c0-3.553-4.737-8.29-8.29-8.29z" /></svg>
                      {/* {(zoomLevel > 11 || isCurrentCave) && <div className='marker-label'>{cave.name}</div>} */}
                      {markerLabel && markerLabel}
                    </div>
                  </Marker>
                )
              }
              )
            }
          </Map>

        )

      }
      <div style={{ position: 'absolute', bottom: '1em', right: '80px', color: '#fff' }}>{Math.round(zoomLevel * 100) / 100}</div>
    </div >
  )
}
