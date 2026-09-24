import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import mapboxgl, { LngLat, Point } from 'mapbox-gl'
import Map, { Marker, GeolocateControl } from 'react-map-gl/mapbox'
import { Box, Fade, SvgIcon } from '@mui/material'
import { FenceRounded } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { chain, debounce } from 'underscore'
import UnstyledLink from '@/components/UnstyledLink.jsx'
import { setViewState, setCurrentCave as setCurrentCaveInStore, clearCurrentCave, setMapData, setPickedCoordinate, setEditFieldCoordinate, clearFlyToCoordinateRequest } from '@/redux/slices/mapSlice.jsx'
import { setTitle } from '@/redux/slices/appSlice.jsx'
import { MapLoading, MapError } from './MapState.jsx'
import { useMapUiReady } from './useMapUiReady.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import useCurrentRoute from '@/hooks/useCurrentRoute.jsx'
import { paneWidth } from '@/config/app.js'
import { SISTEMA_DEFAULT_COLOR, initialViewState as defaultViewState, mapProps, markerConfig } from '@/config/map.js'
import { num } from '@/services/data-service/types.js'
import PinIcon from '@/images/map/pin.svg?react'
import PinLocationUnknownIcon from '@/images/map/pin-location-unknown.svg?react'
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'

Object.defineProperty(mapboxgl.config, 'EVENTS_URL', {
  configurable: true,
  value: null,
})

const MARKER_ANIMATION_DURATION_MS = 680

function EntranceMapMarkerIcon({ size = 28 }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <SvgIcon component={PinIcon} inheritViewBox htmlColor="white" sx={{ width: '100%', height: '100%', display: 'block', color: 'white' }} />
      <FenceRounded sx={{ position: 'absolute', fontSize: size * 0.62, color: '#111827', lineHeight: 1 }} />
    </Box>
  )
}

function hasSavedViewState(viewState) {
  return Number.isFinite(viewState?.longitude) && Number.isFinite(viewState?.latitude) && Number.isFinite(viewState?.zoom)
}

export default function OCMap() {
  const mapRef = useRef()
  const currentMarkerRef = useRef()

  const dataLoadingState = useSelector((state) => state.data.dataLoadingState)
  const searchOptions = useSelector((state) => state.search)
  const _currentCave = useSelector((state) => state.map.currentCave)
  const savedViewState = useSelector((state) => state.map.viewState)
  const currentZoomLevel = useSelector((state) => state.map.currentZoomLevel)
  const mapData = useSelector((state) => state.map.data)
  const caveData = useSelector((state) => state.data.caves)
  const pickingCoordinateFor = useSelector((state) => state.map.pickingCoordinateFor)
  const editFieldCoordinates = useSelector((state) => state.map.editFieldCoordinates)
  const flyToCoordinateRequest = useSelector((state) => state.map.flyToCoordinateRequest)
  const roles = useSelector((state) => state.session.roles)

  const { caveId } = useParams()
  const location = useLocation()
  const currentRoute = useCurrentRoute()

  // Mirrors ResultPane.jsx's own showEditContent check: the in-place edit
  // form (and the widened/elongated pane it renders in) only actually shows
  // for an editor on a /edit URL, so only then does the map need to shift
  // its centering to keep the current cave visible in the narrower
  // remaining space.
  const isWidePaneEditMode = location.pathname.endsWith('/edit') && roles.includes('editor')

  const [mapReady, setMapReady] = useState(false)
  const theme = useTheme()

  const persistedViewStateAvailable = hasSavedViewState(savedViewState)
  const initialMapViewState = persistedViewStateAvailable ? { ...defaultViewState, ...savedViewState } : defaultViewState

  const [currentCave, _setCurrentCave] = useState(_currentCave)
  const [hasInitialGoToMarker, setHasInitialGoToMarker] = useState(false)
  const [activeMarkerElem, doSetActiveMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(initialMapViewState.zoom)
  const [isDraggingCurrentMarker, setIsDraggingCurrentMarker] = useState(false)
  const [mapBounds, setMapBounds] = useState()
  const [mapLoaded, setMapLoaded] = useState(false)

  const dispatch = useDispatch()

  const { t } = useTranslation('map')

  const isSmall = useSmall()

  const filteredCaves = useMemo(() => {
    const filters = {
      coordinates: [(cave) => searchOptions.showValidCoordinates && cave.location.validity === 'valid', (cave) => searchOptions.showInvalidCoordinates && cave.location.validity === 'invalid', (cave) => searchOptions.showUnconfirmedCoordinates && cave.location.validity === 'unknown'],
      accesses: [
        (cave) => {
          return searchOptions.showAccesses.some((access) => {
            return (access.key === 'unknown' ? !Reflect.has(cave, 'access') : access.key === cave.access) && access.checked
          })
        },
      ],
      accessibilities: [
        (cave) => {
          return searchOptions.showAccessibilities.some((accessibility) => {
            return (accessibility.key === 'unknown' ? Reflect.has(cave, 'accessibility') : accessibility.key === cave.accessibility) && accessibility.checked
          })
        },
      ],
    }

    const result = filterCaves(mapData, filters)

    return result
  }, [mapData, searchOptions])

  const displayedCaves = useMemo(() => {
    if (!filteredCaves || !isWidePaneEditMode || !editFieldCoordinates.location) {
      return filteredCaves
    }

    return filteredCaves.map((cave) => {
      if (caveId !== cave.id) {
        return cave
      }

      return {
        ...cave,
        location: {
          ...cave.location,
          longitude: editFieldCoordinates.location.longitude,
          latitude: editFieldCoordinates.location.latitude,
        },
      }
    })
  }, [filteredCaves, isWidePaneEditMode, editFieldCoordinates.location, caveId])

  function filterCaves(caves, filters) {
    function or(filters) {
      return function iteratee(result, item) {
        if (filters.some((filter) => filter(item))) {
          result.push(item)
        }
        return result
      }
    }

    return chain(caves).reduce(or(filters.coordinates), []).reduce(or(filters.accesses), []).value()
  }

  function onMarkerClick(event, cave) {
    if (pickingCoordinateFor) {
      // Don't navigate away to a different cave mid-pick - use this
      // marker's own coordinates as the picked value instead.
      event.originalEvent?.preventDefault()
      event.originalEvent?.stopPropagation()
      dispatch(
        setPickedCoordinate({
          field: pickingCoordinateFor,
          longitude: cave.location.longitude,
          latitude: cave.location.latitude,
        }),
      )
      return
    }

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

      activeMarkerElem.classList.remove('inactive-animate')
      activeMarkerElem.classList.add('inactive-animate')
      window.setTimeout(() => {
        activeMarkerElem.classList.remove('inactive-animate')
      }, MARKER_ANIMATION_DURATION_MS)
    }

    if (markerElem) {
      const activeClass = animate ? 'active' : 'active-animate'

      markerElem.classList.add(activeClass)
      markerElem.dataset.activeClass = activeClass
    }

    doSetActiveMarkerElem(markerElem)
  }

  function getCenterLngLat(lng, lat, offsetForPane = true, zoom = currentZoomLevel) {
    console.log('[getCenterLngLat] %s, %s', lng, lat)
    try {
      const map = mapRef.current
      if (!offsetForPane) {
        return new LngLat(lng, lat)
      }

      // project()/unproject() work in the map's CURRENT view. If the map
      // hasn't already settled at the zoom we're about to fly to (e.g. the
      // very first centering from a fresh/default view), a pixel offset
      // computed here would correspond to a wildly different geographic
      // distance once we actually apply it at `zoom` - snap there first
      // (no animation, immediately overwritten by the real flyTo/jumpTo
      // the caller does with the result) so the offset math below is
      // always computed at the zoom it'll actually be used at.
      if (map.getZoom() !== zoom) {
        map.jumpTo({ center: [lng, lat], zoom })
      }

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
        // Keep in sync with ResultPaneLg.jsx's own `min(paneWidth * 2, 80vw)`
        // cap on its max-width in edit mode.
        const effectivePaneWidth = isWidePaneEditMode ? Math.min(paneWidth * 2, window.innerWidth * 0.8) : paneWidth
        centerPoint = currentPoint.sub(new Point(effectivePaneWidth / 2, 0))
        console.log('[getCenterLngLat] currentPoint', currentPoint)
        console.log('[getCenterLngLat] centerPoint', centerPoint)
      }

      const centerLngLat = map.unproject(centerPoint)

      return centerLngLat
    } catch (error) {
      console.error('Could not compute center lngLat from lng/lat [%o, %o]: %o', lng, lat, error)
    }
  }

  function flyToMarker({ animate = true, cave = currentCave, offsetForPane = true } = {}) {
    console.log('[flyToMarker] animate: %o', animate)
    if (cave && cave.location) {
      const { longitude: lng, latitude: lat } = cave.location
      const currentMarker = mapRef.current?.getMap()._markers.find((marker) => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === lng && markerLngLat.lat === lat
      })

      if (currentMarker) {
        setActiveMarkerElem(currentMarker.getElement(), true)
      }

      const center = getCenterLngLat(lng, lat, offsetForPane)
      const fn = animate ? 'flyTo' : 'jumpTo'

      mapRef.current?.[fn]({
        center,
        zoom: currentZoomLevel,
        ...(animate && {
          duration: theme.oc.sys.motion.duration.emphasized,
        }),
      })
    }
  }

  function flyToCoordinate(lng, lat) {
    const center = getCenterLngLat(lng, lat, true)

    mapRef.current?.flyTo({
      center,
      zoom: currentZoomLevel,
      duration: theme.oc.sys.motion.duration.emphasized,
    })
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

  function onMapClick(event) {
    if (!pickingCoordinateFor) {
      return
    }

    const picked = {
      field: pickingCoordinateFor,
      longitude: num(event.lngLat.lng, 5),
      latitude: num(event.lngLat.lat, 5),
    }

    dispatch(
      setEditFieldCoordinate({
        field: pickingCoordinateFor,
        longitude: picked.longitude,
        latitude: picked.latitude,
      }),
    )
    dispatch(setPickedCoordinate(picked))
  }

  // Drop target for CoordinateField.jsx's draggable pin: its drag image is
  // offset to the pin's bottom tip (see onPinDragStart there), so the
  // pointer position at drop time - not wherever the pin was grabbed - is
  // exactly the coordinate to unproject.
  function onMapDragOver(event) {
    if (pickingCoordinateFor) {
      event.preventDefault()
    }
  }

  function onMapDrop(event) {
    if (!pickingCoordinateFor || !mapRef.current) {
      return
    }

    event.preventDefault()

    const containerRect = mapRef.current.getMap().getContainer().getBoundingClientRect()
    const lngLat = mapRef.current.unproject([event.clientX - containerRect.left, event.clientY - containerRect.top])
    const picked = {
      field: pickingCoordinateFor,
      longitude: num(lngLat.lng, 5),
      latitude: num(lngLat.lat, 5),
    }

    dispatch(
      setEditFieldCoordinate({
        field: pickingCoordinateFor,
        longitude: picked.longitude,
        latitude: picked.latitude,
      }),
    )
    dispatch(setPickedCoordinate(picked))
  }

  function onFieldMarkerDragEnd(field, event) {
    const picked = {
      field,
      longitude: num(event.lngLat.lng, 5),
      latitude: num(event.lngLat.lat, 5),
    }

    dispatch(
      setEditFieldCoordinate({
        field,
        longitude: picked.longitude,
        latitude: picked.latitude,
      }),
    )
    dispatch(setPickedCoordinate(picked))
  }

  /**
   * IGNORE START
   */
  useEffect(() => {
    console.log('currentMarkerRef: ', currentMarkerRef)
  }, [currentMarkerRef])
  useEffect(() => {
    console.log('uiReady: ', uiReady)
  }, [uiReady])
  useEffect(() => {
    console.log('======================================================================')
  }, [])
  useEffect(() => {
    console.log('==== currentCave: ', currentCave)
  }, [currentCave])

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
    dispatch(setMapData(caveData.filter((c) => c.location)))

    // const pathname = router.routeInfo.pathname

    if (!caveId) {
      _setCurrentCave(null)
      setActiveMarkerElem(null)
      setMapReady(true)
      return
    }

    const routeCave = caveData.find((cave) => cave.id === caveId)
    if (routeCave) {
      setCurrentCave(routeCave)

      // A cave with no location has no marker of its own to select, but a
      // previously-selected marker (from whatever cave was open before)
      // needs to be explicitly cleared here - flyToMarker() would normally
      // do that as a side effect of moving to the new marker, but it no-ops
      // entirely when the new cave has no location to fly to.
      if (!routeCave.location) {
        setActiveMarkerElem(null)
      }
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
  }, [caveData, caveId])

  useEffect(() => {
    if (!mapLoaded || !caveId) {
      return
    }

    const routeCave = caveData.find((cave) => cave.id === caveId)

    if (persistedViewStateAvailable && _currentCave?.id === caveId && routeCave?.location) {
      const currentMarker = mapRef.current?.getMap()._markers.find((marker) => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === routeCave.location.longitude && markerLngLat.lat === routeCave.location.latitude
      })

      if (currentMarker) {
        setActiveMarkerElem(currentMarker.getElement(), true)
      }

      return
    }
    if (routeCave?.location) {
      // offsetForPane matters a lot now that the pane can be much wider in
      // edit mode (see ResultPaneLg.jsx) - without it, a cave (and any
      // entrance point further from it) can land squarely behind the pane
      // on first load and never be visible at all.
      flyToMarker({ animate: true, cave: routeCave, offsetForPane: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, caveId, caveData, currentZoomLevel, persistedViewStateAvailable, _currentCave])

  // Re-center when entering/exiting quick-edit mode, since the result pane
  // doubling in width (see ResultPaneLg.jsx) changes how much of the map is
  // actually free to the right of it. Skip the very first run - the initial
  // centering effects above already account for isWidePaneEditMode via
  // getCenterLngLat, so re-flying here too would just be a redundant jump.
  const skipNextWidePaneFly = useRef(true)
  useEffect(() => {
    if (skipNextWidePaneFly.current) {
      skipNextWidePaneFly.current = false
      return
    }

    if (mapLoaded && currentCave?.location) {
      flyToMarker({ animate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWidePaneEditMode])

  // A CoordinateField's own "center the map here" action.
  useEffect(() => {
    if (flyToCoordinateRequest && mapLoaded) {
      flyToCoordinate(flyToCoordinateRequest.longitude, flyToCoordinateRequest.latitude)
      dispatch(clearFlyToCoordinateRequest())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToCoordinateRequest, mapLoaded])

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
    return <MapError error={dataLoadingState.error} />
  }

  return (
    <Box className="oc-map-container">
      <Fade timeout={theme.transitions.duration.complex} in={!mapReady || dataLoadingState.state === 'loading'} unmountOnExit={true}>
        <MapLoading />
      </Fade>
      <Fade timeout={theme.transitions.duration.complex} in={mapReady && dataLoadingState.state === 'loaded'}>
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
          }}
          onDragOver={onMapDragOver}
          onDrop={onMapDrop}
        >
          <Map ref={mapRef} {...mapProps} mapboxAccessToken={import.meta.env.REACT_APP_MAPBOX_ACCESS_TOKEN} initialViewState={initialMapViewState} cursor={pickingCoordinateFor ? 'crosshair' : 'grab'} onClick={onMapClick} onDragEnd={onDragEnd} onMove={onMove} onMoveEnd={onMoveEnd} onZoom={onZoom} onZoomEnd={onZoomEnd} onLoad={onLoad}>
            <GeolocateControl
              positionOptions={{ enableHighAccuracy: true }}
              // trackUserLocation={true}
              position="bottom-right"
              onError={onGeolocateError}
            />

            {/* 'location' isn't rendered here - it's the same point as the
                current cave's own marker below, which becomes draggable
                instead of duplicating it with a second pin. */}
            {isWidePaneEditMode &&
              Object.entries(editFieldCoordinates)
                .filter(([field]) => field !== 'location')
                .map(([field, { longitude, latitude }]) => {
                  const isEntranceField = field === 'entrance'

                  return (
                    <Marker key={`edit-field-${field}`} longitude={longitude} latitude={latitude} anchor="bottom" draggable onDragEnd={(event) => onFieldMarkerDragEnd(field, event)}>
                      {/* .marker-icon's own cursor:pointer would otherwise win over sx - force the open-hand grab cursor. */}
                      <Box className="marker-icon" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab !important', width: 28, height: 28 }}>
                        {isEntranceField ? (
                          <EntranceMapMarkerIcon size={28} />
                        ) : (
                          <SvgIcon inheritViewBox htmlColor={theme.palette.secondary.main} sx={{ width: '100%', height: '100%' }}>
                            <PinIcon />
                          </SvgIcon>
                        )}
                      </Box>
                    </Marker>
                  )
                })}

            {displayedCaves
              ?.filter(({ location }) => {
                const lngLat = new LngLat(location.longitude, location.latitude)
                return mapBounds ? mapBounds.contains(lngLat) : true
              })
              .map((cave, i) => {
                const isCurrentCave = caveId === cave.id
                const caveName = cave.name ? cave.name.value : t('caveNameUnknown')
                const markerColor = cave.sistemas ? cave.sistemas[cave.sistemas.length - 1].color : SISTEMA_DEFAULT_COLOR
                const pinIcon = cave.location.validity === 'valid' ? PinIcon : PinLocationUnknownIcon
                if (isCurrentCave) {
                  console.log('isCurrentCave? (%s): %o', caveName, isCurrentCave)
                }

                const isDraggableCurrentCave = isCurrentCave && isWidePaneEditMode

                // Always label the current cave's own marker while its
                // in-place edit form (and this marker's own draggability)
                // is active, regardless of zoom - not just above the
                // general label zoom threshold. Hidden while actively being
                // dragged so the name doesn't trail the pin around.
                let markerLabel = null
                if (!(isDraggableCurrentCave && isDraggingCurrentMarker) && (zoomLevel > markerConfig.label.minZoomLevel || (isCurrentCave && isWidePaneEditMode))) {
                  markerLabel = (
                    <div key={`marker-${cave.id}`} className="marker-label">
                      {caveName}
                    </div>
                  )
                }

                return (
                  <Marker
                    key={`m-${cave.id}`}
                    longitude={cave.location.longitude}
                    latitude={cave.location.latitude}
                    anchor="center"
                    className={isCurrentCave ? 'active' : undefined}
                    onClick={(event) => onMarkerClick(event, cave)}
                    draggable={isDraggableCurrentCave}
                    onDragStart={isDraggableCurrentCave ? () => setIsDraggingCurrentMarker(true) : undefined}
                    onDragEnd={
                      isDraggableCurrentCave
                        ? (event) => {
                            setIsDraggingCurrentMarker(false)
                            onFieldMarkerDragEnd('location', event)
                          }
                        : undefined
                    }
                  >
                    <UnstyledLink to={`/map/${cave.id}`} replace={currentRoute.id === 'result-pane'} className="marker" id={isCurrentCave ? 'active-marker' : null}>
                      <SvgIcon inheritViewBox className={`marker-icon ${markerColor === SISTEMA_DEFAULT_COLOR ? 'marker-icon-default' : ''}`} htmlColor={markerColor} sx={isDraggableCurrentCave ? { cursor: 'grab !important' } : undefined}>
                        {pinIcon &&
                          (() => {
                            const Pin = pinIcon
                            return <Pin />
                          })()}
                      </SvgIcon>
                      {markerLabel && markerLabel}
                    </UnstyledLink>
                  </Marker>
                )
              })}
          </Map>
        </Box>
      </Fade>
    </Box>
  )
}
