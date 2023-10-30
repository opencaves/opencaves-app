import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { LngLat } from 'mapbox-gl'
import Map, { Marker, Popup, GeolocateControl, Source, Layer } from 'react-map-gl'
import { Box, SvgIcon } from '@mui/material'
import { chain, debounce } from 'underscore'
import { setShowPopup, setPopupData, setViewState, setCurrentCave, setMapData } from '@/redux/slices/mapSlice'
import { setTitle } from '@/redux/slices/appSlice'
import { MapLoading, MapError } from './MapState'
import { hasViewState } from './location-view-state'
import { useSmall } from '@/hooks/useSmall'
import useCurrentRoute from '@/hooks/useCurrentRoute'
import { SISTEMA_DEFAULT_COLOR, initialViewState as defaultViewState, mapProps, markerConfig } from '@/config/map'
import { ReactComponent as PinIcon } from '@/images/map/pin.svg'
import { ReactComponent as PinLocationUnknownIcon } from '@/images/map/pin-location-unknown.svg'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'

export default function OCMap() {

  const dataLoadingState = useSelector(state => state.data.dataLoadingState)
  const showPopup = useSelector(state => state.map.showPopup)
  const popupData = useSelector(state => state.map.popupData)
  const searchOptions = useSelector(state => state.search)
  const currentCave = useSelector(state => state.map.currentCave)
  const currentZoomLevel = useSelector(state => state.map.currentZoomLevel)
  const mapData = useSelector(state => state.map.data)
  const caveData = useSelector(state => state.data.caves)

  const { caveId } = useParams()
  const navigate = useNavigate()
  const currentRoute = useCurrentRoute()

  const [mapReady, setMapReady] = useState(false)
  const [currentMarkerElem, doSetCurrentMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(defaultViewState.zoom)
  const [initialViewState, setInitialViewState] = useState(defaultViewState)
  const [mapBounds, setMapBounds] = useState()

  const mapRef = useRef()
  const markersRef = useRef([])

  const dispatch = useDispatch()

  const { t } = useTranslation('map')

  // query: '(max-width: 767px)'
  const isSmall = useSmall()

  const filteredCaves = useMemo(() => {

    const filters = {
      coordinates: [
        cave => searchOptions.showValidCoordinates && cave.location.validity === 'valid',
        cave => searchOptions.showInvalidCoordinates && cave.location.validity === 'invalid',
        cave => searchOptions.showUnconfirmedCoordinates && cave.location.validity === 'unknown',
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

  function markerOnClick(event, cave) {

    dispatch(setCurrentCave(cave))

    setCurrentMarkerElem(event.target.getElement())

    navigate(`/map/${cave.id}`, { replace: currentRoute.id === 'result-pane' })

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
      goToCurrentMarker()
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

  function goToCurrentMarker(flyTo = true) {
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

  function updateMapBounds() {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds()
      setMapBounds(bounds)
    }
  }

  function onDragEnd() {
    // Set current map bounds
    updateMapBounds()
  }

  const onMove = debounce(function (event) {
    dispatch(setViewState(event.viewState))
  }, 300)

  function onMoveEnd() {
    // Set current map bounds
    updateMapBounds()
  }

  function onZoom(event) {
    setZoomLevel(event.viewState.zoom)
  }

  function onZoomEnd() {
    // Set current map bounds
    updateMapBounds()
  }

  function onLoad() {
    // Disable touch rotation
    mapRef.current?.getMap().touchZoomRotate.disableRotation()

    // Set initial map bounds
    setMapBounds()

    // Fly to marker if no view state in the URL
    const flyTo = !hasViewState()
    goToCurrentMarker(flyTo)
  }

  function onGeolocateError(error) {
    console.error('[onGeolocateError] %o', error)
  }

  //
  // initialisation
  //

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {

    dispatch(setMapData(caveData.filter(c => c.location)))

    // const pathname = router.routeInfo.pathname

    if (!caveId) {
      setMapReady(true)
      return
    }

    if (currentCave) {

      if (currentCave.location) {

        const newInitialViewState = {
          longitude: currentCave.location.longitude,
          latitude: currentCave.location.latitude,
          zoom: currentZoomLevel
        }
        setInitialViewState(newInitialViewState)
        setZoomLevel(newInitialViewState.zoom)
      }
    }

    setMapReady(true)
  }, [caveData, currentCave])

  if (dataLoadingState.state === 'error') {
    return (
      <MapError error={dataLoadingState.error} />
    )
  }

  return (
    <Box className='oc-map-container'>
      {
        (!mapReady || dataLoadingState.state === 'loading') && (
          // true && (
          <MapLoading />
        )
      }
      {
        mapReady && dataLoadingState.state === 'loaded' && (
          <Map
            ref={mapRef}
            {...mapProps}
            initialViewState={initialViewState}
            onDragEnd={onDragEnd}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
            onZoom={onZoom}
            onZoomEnd={onZoomEnd}
            onLoad={onLoad}
          >

            <GeolocateControl
              positionOptions={{ enableHighAccuracy: true }}
              // trackUserLocation={true}
              position='bottom-right'
              onError={onGeolocateError}
            />

            {
              showPopup && (
                <Popup longitude={popupData.location?.longitude} latitude={popupData.location?.latitude}
                  anchor='bottom'
                // onClose={() => setShowPopup(false)}
                >
                  You are here
                </Popup>
              )
            }

            {
              filteredCaves?.filter(({ location }) => {
                const lngLat = new LngLat(location.longitude, location.latitude)
                return mapBounds ? mapBounds.contains(lngLat) : true
              }).map((cave, i) => {
                // console.log('cave: %o', cave)
                const isCurrentCave = currentCave && currentCave.id === cave.id
                const caveName = cave.name ? cave.name.value : t('caveNameUnknown')
                const markerColor = cave.sistemas ? cave.sistemas[cave.sistemas.length - 1].color : SISTEMA_DEFAULT_COLOR
                const pinIcon = cave.location.validity === 'valid' ? PinIcon : PinLocationUnknownIcon

                markersRef.current.push(createRef())

                let markerLabel = null
                if (isCurrentCave) {
                  if (zoomLevel > markerConfig.label.minZoomLevel) {
                    markerLabel = <div key={`marker-${cave.id}`} className='marker-label'>{caveName}</div>
                  }
                } else {
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
                    onClick={(event) => markerOnClick(event, cave)}
                  >
                    <div className='marker'>
                      <SvgIcon component={pinIcon} inheritViewBox className={`marker-icon ${markerColor === SISTEMA_DEFAULT_COLOR ? 'marker-icon-default' : ''}`} htmlColor={markerColor} />
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
    </Box>
  )
}
