import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Map, { Marker, Popup, GeolocateControl, Source, Layer } from 'react-map-gl'
import { useIonRouter } from '@ionic/react'
import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { chain, debounce } from 'underscore'
import { setShowPopup, setPopupData, setViewState, setCurrentCave, setMapData } from '../../redux/slices/mapSlice'
import { MapLoading, MapError } from './MapState'
import { hasViewState } from './location-view-state'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'

export default function OCMap() {

  const dataLoadingState = useSelector(state => state.data.dataLoadingState)
  const mapProps = useSelector(state => state.map.mapProps)
  const defaultViewState = useSelector(state => state.map.initialViewState)
  const markerConfig = useSelector(state => state.map.marker)
  const showPopup = useSelector(state => state.map.showPopup)
  const popupData = useSelector(state => state.map.popupData)
  const searchOptions = useSelector(state => state.search)
  const currentCave = useSelector(state => state.map.currentCave)
  const currentZoomLevel = useSelector(state => state.map.currentZoomLevel)
  const mapData = useSelector(state => state.map.data)
  const caveData = useSelector(state => state.data.caves)

  const theme = useTheme()

  const [mapReady, setMapReady] = useState(false)
  const [currentMarkerElem, doSetCurrentMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(defaultViewState.zoom)
  const [initialViewState, setInitialViewState] = useState(defaultViewState)

  const mapRef = useRef()
  const markersRef = useRef([])

  const router = useIonRouter()

  const dispatch = useDispatch()

  const { t } = useTranslation('map')

  // query: '(max-width: 767px)'
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const filteredCaves = useMemo(() => {
    console.log('filtering %s caves', mapData.length)

    const filters = {
      coordinates: [
        cave => searchOptions.showValidCoordinates && cave.location.validity === 'valid',
        cave => searchOptions.showInvalidCoordinates && cave.location.validity === 'invalid',
        cave => searchOptions.showUnknownCoordinates && cave.location.validity === 'unknown',
      ],
      accesses: [
        cave => {
          return searchOptions.showAccesses.some(access => {
            return (access.key === 'unknown' ? !Reflect.has(cave, 'access') : access.key === cave.access) && access.checked
          })
        },
      ],
      accessibilities: [
        cave => {
          return searchOptions.showAccessibilities.some(accessibility => {
            return (accessibility.key === 'unknown' ? Reflect.has(cave, 'accessibility') : accessibility.key === cave.accessibility) && accessibility.checked
          })
        }
      ]
    }

    const result = filterCaves(mapData, filters)
    console.log('found %s caves', result.length)
    return result


  }, [mapData, searchOptions])

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

    dispatch(setCurrentCave(cave))

    setCurrentMarkerElem(event.target.getElement())

    router.push(`/map/${cave.id}`, 'none', 'replace')

    if (isSmall) {
      // Center around selected marker
      mapRef.current.flyTo({
        center: [cave.location.longitude, cave.location.latitude]
      })
    }

  }

  useEffect(() => {
    if (!currentCave) {
      setCurrentMarkerElem()
    } else {
      showCurrentCave()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCave])

  function setCurrentMarkerElem(markerElem, animated = false) {
    if (currentMarkerElem) {
      currentMarkerElem.classList.remove(currentMarkerElem.dataset.activeClass)
      delete currentMarkerElem.dataset.activeClass
    }

    if (markerElem) {

      const activeClass = animated ? 'active' : 'active-animated'

      markerElem.classList.add(activeClass)
      markerElem.dataset.activeClass = activeClass
    }

    doSetCurrentMarkerElem(markerElem)
  }

  function showCurrentCave(flyTo = true) {
    if (currentCave && currentCave.location) {
      const { longitude: lng, latitude: lat } = currentCave.location
      const currentMarker = mapRef.current?.getMap()._markers.find(marker => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === lng && markerLngLat.lat === lat
      })

      if (currentMarker) {
        setCurrentMarkerElem(currentMarker.getElement(), true)
      }

      if (flyTo) {
        mapRef.current && mapRef.current.flyTo({
          center: [lng, lat],
          zoom: currentZoomLevel
        })
      }

    }
  }

  function onMouseEnter(event) {
    console.log('[onMouseEnter] %o', event)
  }

  const onMove = debounce(function (event) {
    // console.log('[onMove] event: %o', event)
    dispatch(setViewState(event.viewState))
  }, 300)

  function onZoom(event) {
    setZoomLevel(event.viewState.zoom)
  }

  function onLoad() {
    // Disable touch rotation
    mapRef.current?.getMap().touchZoomRotate.disableRotation()

    // Fly to marker if no view state in the URL
    const flyTo = !hasViewState()
    showCurrentCave(flyTo)
  }

  function onGeolocateError(error) {
    console.error('[onGeolocateError] %o', error)
  }

  // initialisation
  useEffect(() => {
    console.log('fire once: %o', router)

    dispatch(setMapData(caveData.filter(c => c.location)))

    const pathname = router.routeInfo.pathname
    if (pathname === '/map') {
      setMapReady(true)
      return
    }

    // route: /map/:id
    const id = pathname.split('/').pop()
    const newCurrentCave = caveData.find(cave => cave.id === id)
    if (newCurrentCave) {

      dispatch(setCurrentCave(newCurrentCave))

      if (newCurrentCave.location) {

        const newInitialViewState = {
          longitude: newCurrentCave.location.longitude,
          latitude: newCurrentCave.location.latitude,
          // zoom: defaultDetailedViewZoom
          zoom: currentZoomLevel
        }
        setInitialViewState(newInitialViewState)
        setZoomLevel(newInitialViewState.zoom)
      }
    }

    setMapReady(true)
  }, [caveData])

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
              filteredCaves?.map((cave, i) => {
                // console.log('cave: %o', cave)
                const isCurrentCave = currentCave && currentCave.id === cave.id
                const caveName = cave.name ? cave.name.value : t('caveNameUnknown')
                markersRef.current.push(createRef())

                let markerLabel = null
                if (isCurrentCave) {
                  // if (zoomLevel < markerConfig.current.label.maxZoomLevel) {
                  if (zoomLevel > markerConfig.label.minZoomLevel) {
                    markerLabel = <div key={`marker-${cave.id}`} className='marker-label'>{caveName}</div>
                  }
                } else {
                  // console.log('[%s] zoomLevel: %s, minZoomLevel: %s', zoomLevel < markerConfig.label.minZoomLevel, zoomLevel, markerConfig.label.minZoomLevel)
                  if (zoomLevel > markerConfig.label.minZoomLevel) {
                    markerLabel = <div key={`marker-${cave.id}`} className='marker-label'>{caveName}</div>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="28.15" preserveAspectRatio="xMidYMid" version="1.0" className="marker-icon"><path fill={cave.color} stroke="#23272b" strokeWidth=".6" d="M11.3 25.75c.85-2.475 1.725-3.9 4.576-7.401 1.15-1.425 2.375-3.15 2.7-3.8C21.451 8.822 18.626 2.345 12.5.57c-.337-.1-1.973-.27-2.5-.271C9.473.3 7.837.47 7.5.57 1.373 2.346-1.453 8.822 1.423 14.548c.324.65 1.55 2.376 2.7 3.8 2.85 3.501 3.725 4.927 4.576 7.402.625 1.875.763 2.097 1.3 2.1.536.003.675-.225 1.3-2.1z" /><path fill="#fff" fillRule="evenodd" d="M5.81 12.208c0-1.047 2.095-4.188 4.164-4.187 2.118 0 4.213 3.14 4.213 4.187H9.998zm4.188-7.329c-3.141 0-7.328 4.189-7.328 7.329h1.046c0-3.142 4.189-6.282 6.282-6.282 2.094 0 6.282 3.142 6.282 6.282h1.047c0-3.142-4.188-7.329-7.329-7.329z" /></svg>
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
      {/* <div style={{ position: 'absolute', bottom: '1em', right: '80px', color: '#fff' }}>{Math.round(zoomLevel * 100) / 100}</div> */}
    </div >
  )
}
