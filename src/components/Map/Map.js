import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { LngLat, Point } from 'mapbox-gl'
import Map, { Marker, GeolocateControl } from 'react-map-gl'
import { Box, Fade, SvgIcon } from '@mui/material'
import { chain, debounce } from 'underscore'
import UnstyledLink from '@/components/UnstyledLink'
import { setViewState, setCurrentCave as setCurrentCaveInStore, clearCurrentCave, setMapData } from '@/redux/slices/mapSlice'
import { setTitle } from '@/redux/slices/appSlice'
import { MapLoading, MapError } from './MapState'
import { hasViewState } from './location-view-state'
import { useSmall } from '@/hooks/useSmall'
import useCurrentRoute from '@/hooks/useCurrentRoute'
import { paneWidth } from '@/config/app'
import { SISTEMA_DEFAULT_COLOR, initialViewState as defaultViewState, mapProps, markerConfig } from '@/config/map'
import { ReactComponent as PinIcon } from '@/images/map/pin.svg'
import { ReactComponent as PinLocationUnknownIcon } from '@/images/map/pin-location-unknown.svg'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'
import { useMapUiReady } from './useMapUiReady'
import { useTheme } from '@mui/material-next'

export default function OCMap() {

  const mapRef = useRef()
  const currentMarkerRef = useRef()

  const dataLoadingState = useSelector(state => state.data.dataLoadingState)
  const searchOptions = useSelector(state => state.search)
  const _currentCave = useSelector(state => state.map.currentCave)
  const currentZoomLevel = useSelector(state => state.map.currentZoomLevel)
  const mapData = useSelector(state => state.map.data)
  const caveData = useSelector(state => state.data.caves)

  const { caveId } = useParams()
  const currentRoute = useCurrentRoute()

  const [mapReady, setMapReady] = useState(false)
  const theme = useTheme()

  const [currentCave, _setCurrentCave] = useState(_currentCave)
  const [hasInitialGoToMarker, setHasInitialGoToMarker] = useState(false)
  const [activeMarkerElem, doSetActiveMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(defaultViewState.zoom)
  const [initialViewState, setInitialViewState] = useState(defaultViewState)
  const [mapBounds, setMapBounds] = useState()
  const [mapLoaded, setMapLoaded] = useState(false)

  const dispatch = useDispatch()

  const { t } = useTranslation('map')

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

  function onMarkerClick(event, cave) {
    setActiveMarkerElem(event.target.getElement())
  }

  const uiReady = useMapUiReady(mapLoaded, activeMarkerElem)

  // useEffect(() => {
  //   if (!currentCave) {
  //     console.log('NO CURRENT CAVE')
  //     setActiveMarkerElem()
  //   } else {
  //     console.log('current cave changed: %o', currentCave)
  //     if (mapRef.current) {
  //       flyToMarker()
  //     }
  //   }

  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [currentCave, mapRef])

  function setCurrentCave(newCurrentCave) {

    if (currentCave !== newCurrentCave) {
      console.log('%c[setCurrentCave] %o, current cave === new current cave ? %o', 'color: cyan;', newCurrentCave, currentCave === newCurrentCave)
      _setCurrentCave(newCurrentCave)
      dispatch(setCurrentCaveInStore(newCurrentCave))
    }
  }

  function setActiveMarkerElem(markerElem, animate = false) {
    console.log('### [setActiveMarkerElem] markerElem: ', markerElem)
    if (activeMarkerElem) {
      activeMarkerElem.classList.remove(activeMarkerElem.dataset.activeClass)
      delete activeMarkerElem.dataset.activeClass
    }

    if (markerElem) {

      const activeClass = animate ? 'active' : 'active-animate'

      markerElem.classList.add(activeClass)
      markerElem.dataset.activeClass = activeClass
    }

    doSetActiveMarkerElem(markerElem)
  }

  function getCenterLngLat(lng, lat) {
    console.log('[getCenterLngLat] %s, %s', lng, lat)
    try {
      const map = mapRef.current
      const currentPoint = map.project([lng, lat])
      let centerPoint

      if (isSmall) {
        const viewportBounding = document.querySelector('#root').getBoundingClientRect()
        const resultPaneBounding = document.querySelector('#oc-result-pane').getBoundingClientRect()
        const searchBarBounding = document.querySelector('#oc-search-bar').getBoundingClientRect()

        const resultPaneHeight = viewportBounding.height - resultPaneBounding.y
        const searchBarHeight = searchBarBounding.y

        centerPoint = currentPoint.add(new Point(0, resultPaneHeight / 2)).sub(new Point(0, searchBarHeight / 2))
      } else {
        centerPoint = currentPoint.sub(new Point(paneWidth / 2, 0))
        console.log('[getCenterLngLat] currentPoint', currentPoint)
        console.log('[getCenterLngLat] centerPoint', centerPoint)
      }

      const centerLngLat = map.unproject(centerPoint)

      return centerLngLat
    } catch (error) {
      console.error('Could not compute center lngLat from lng/lat [%o, %o]: %o', lng, lat, error)
    }

  }

  function flyToMarker({ animate = true, zoomTo = false } = {}) {
    console.log('[flyToMarker] animate: %o', animate)
    if (currentCave && currentCave.location) {
      const { longitude: lng, latitude: lat } = currentCave.location
      const currentMarker = mapRef.current?.getMap()._markers.find(marker => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === lng && markerLngLat.lat === lat
      })

      if (currentMarker) {
        setActiveMarkerElem(currentMarker.getElement(), true)
      }

      const center = getCenterLngLat(lng, lat)
      const fn = animate ? 'flyTo' : 'jumpTo'

      mapRef.current?.[fn]({
        center,
        zoom: currentZoomLevel
      })

    }
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
    console.log('[onLoad] mapRef: %o', mapRef)
    // Disable touch rotation
    mapRef.current?.getMap().touchZoomRotate.disableRotation()
    setMapLoaded(true)

    // Set initial map bounds
    setMapBounds()

    console.log('uiReady: ', uiReady)

    // flyToMarker(false)
  }

  function onGeolocateError(error) {
    console.error('[onGeolocateError] %o', error)
  }

  /**
   * IGNORE START
   */
  useEffect(() => { console.log('currentMarkerRef: ', currentMarkerRef) }, [currentMarkerRef])
  useEffect(() => { console.log('uiReady: ', uiReady) }, [uiReady])
  useEffect(() => { console.log('======================================================================') }, [])
  useEffect(() => { console.log('==== currentCave: ', currentCave) }, [currentCave])

  /**
   * IGNORE END
   */


  /*
   * Initialisation
  */

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // //
  // // Reset current cave
  // //
  // useEffect(() => {
  //   // console.log('location: ', location.pathname)
  //   console.log('currentRoute: ', currentRoute)
  //   if (currentRoute.id === '') {

  //   }
  // }, [currentRoute])

  useEffect(() => {

    dispatch(setMapData(caveData.filter(c => c.location)))

    // const pathname = router.routeInfo.pathname

    if (!caveId) {
      setMapReady(true)
      return
    }

    if (caveData) {

      const initialCave = caveData
      console.log('ici: ', caveData)

      // setCurrentCave(currentCave)


      // setHasInitialGoToMarker(true)
    }

    // if (currentCave) {

    //   if (currentCave.location) {

    //     const newInitialViewState = {
    //       longitude: currentCave.location.longitude,
    //       latitude: currentCave.location.latitude,
    //       zoom: currentZoomLevel
    //     }
    //     setInitialViewState(newInitialViewState)
    //     setZoomLevel(newInitialViewState.zoom)

    //     setCurrentCave(currentCave)


    //     setHasInitialGoToMarker(true)
    //   }
    // }

    setMapReady(true)
  }, [caveData, currentCave])

  useEffect(() => {
    if (mapReady && hasInitialGoToMarker && activeMarkerElem) {
      console.log('[mapReady] hasInitialGoToMarker: ', hasInitialGoToMarker)
      console.log('[mapReady] activeMarkerElem: ', activeMarkerElem)
      // setHasInitialGoToMarker(false)
      flyToMarker({ animate: false })
    }
  }, [mapReady, hasInitialGoToMarker, activeMarkerElem])

  // useEffect(() => {
  //   console.log('mapReady: %o, dataLoadingState: %o', mapReady, dataLoadingState)
  // }, [dataLoadingState, mapReady])

  if (dataLoadingState.state === 'error') {
    return (
      <MapError error={dataLoadingState.error} />
    )
  }

  return (
    <Box className='oc-map-container'>
      <Fade
        timeout={theme.transitions.duration.complex}
        in={!mapReady || dataLoadingState.state === 'loading'}
        unmountOnExit={true}
      >
        <MapLoading />
      </Fade>
      <Fade
        timeout={theme.transitions.duration.complex}
        in={mapReady && dataLoadingState.state === 'loaded'}
      >
        <Box sx={{
          position: 'absolute',
          width: '100%',
          height: '100%'
        }}>
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
              filteredCaves?.filter(({ location }) => {
                const lngLat = new LngLat(location.longitude, location.latitude)
                return mapBounds ? mapBounds.contains(lngLat) : true
              }).map((cave, i) => {
                const isCurrentCave = caveId === cave.id
                const caveName = cave.name ? cave.name.value : t('caveNameUnknown')
                const markerColor = cave.sistemas ? cave.sistemas[cave.sistemas.length - 1].color : SISTEMA_DEFAULT_COLOR
                const pinIcon = cave.location.validity === 'valid' ? PinIcon : PinLocationUnknownIcon
                if (isCurrentCave) {
                  console.log('isCurrentCave? (%s): %o', caveName, isCurrentCave)
                }

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
                    onClick={(event) => onMarkerClick(event, cave)}
                  >
                    <UnstyledLink
                      to={`/map/${cave.id}`}
                      replace={currentRoute.id === 'result-pane'}
                      className='marker'
                      id={isCurrentCave ? 'active-marker' : null}
                    >
                      <SvgIcon component={pinIcon} inheritViewBox className={`marker-icon ${markerColor === SISTEMA_DEFAULT_COLOR ? 'marker-icon-default' : ''}`} htmlColor={markerColor} />
                      {markerLabel && markerLabel}
                    </UnstyledLink>
                  </Marker>
                )
              }
              )
            }
          </Map>
        </Box>
      </Fade>
    </Box>
  )
}
