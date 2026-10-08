import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import mapboxgl, { LngLat, Point } from 'mapbox-gl'
import Map, { Marker, GeolocateControl } from 'react-map-gl/mapbox'
import { Box, Fade, SvgIcon } from '@mui/material'
import FenceRounded from '@mui/icons-material/FenceRounded'
import VpnKeyRounded from '@mui/icons-material/VpnKeyRounded'
import { useTheme } from '@mui/material/styles'
import { chain, debounce } from 'underscore'
import { clearViewResetRequest, setViewState, setCurrentCave as setCurrentCaveInStore, clearCurrentCave, setMapData, setPickedCoordinate, setEditFieldCoordinate, clearFlyToCoordinateRequest } from '@/redux/slices/mapSlice.jsx'
import { MapLoading, MapError } from './MapState.jsx'
import { useMapUiReady } from './useMapUiReady.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import useCurrentRoute from '@/hooks/useCurrentRoute.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { PANE_WIDTH } from '@/config/app.js'
import { SISTEMA_DEFAULT_COLOR, INITIAL_VIEW_STATE as defaultViewState, MAP_PROPS, MARKER_CONFIG, COORDINATE_DECIMALS } from '@/config/map.js'
import { num } from '@/services/data-service/types.js'
import PinIcon from '@/images/map/pin.svg?react'
import PinBadgeIcon from './PinBadgeIcon.jsx'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { locationViewState, writeMapHash } from './location-view-state.js'
import PlaceOnMapOverlay from './PlaceOnMapOverlay.jsx'
import GeolocateTooltip from './GeolocateTooltip.jsx'
import CaveMarker from './CaveMarker.jsx'
import CaveLayer, { caveTileRequest } from './CaveLayer.jsx'

// Decorative markers (a cave's entrance and keys, edited coordinates) keep
// Mapbox's role="img", with a real label instead of its "Map marker". Cave
// pins drop that role (see CaveMarker).
function labelMarker(label) {
  return (marker) => marker?.getElement().setAttribute('aria-label', label)
}
import 'mapbox-gl/dist/mapbox-gl.css'
import './Map.scss'
import './Marker.scss'
import { homeBounds } from './homeBounds.js'

// Pins revealed per frame on first load (see markerLimit).
const MARKER_REVEAL_BATCH = 15

Object.defineProperty(mapboxgl.config, 'EVENTS_URL', {
  configurable: true,
  value: null,
})

const MARKER_ANIMATION_DURATION_MS = 680

// Special-point fields (as opposed to the cave's own sistema-colored
// location marker) get a white pin badged with a small glyph identifying
// which point it is.
const EDIT_FIELD_BADGE_ICONS = {
  entrance: FenceRounded,
  key: VpnKeyRounded,
}

// How long after centering on a cave (phone) its offset keeps following the
// layout, and how many unchanged frames count as settled.
// An embedded map's first view of its cave (OCMap's embedded).
const EMBEDDED_ZOOM = 15
// The selected cave's entrance and key points: their icon alone, in the
// pin's colour, with a dark edge and a soft shadow so any colour reads over
// the imagery, at the size it had in the pin's head, its label under it. The
// marker's top sits half an icon above the point, so the icon is centred on it.
const POINT_ICON_SX = { fontSize: 13, filter: 'drop-shadow(0 0 1px #23272b) drop-shadow(0 0 0.5px #23272b) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))' }
const POINT_ICON_OFFSET = [0, -6.5]
const POINT_SX = { display: 'flex', flexDirection: 'column', alignItems: 'center' }
const SETTLE_TIMEOUT = 2000
const SETTLE_FRAMES = 10

// The phone layout the pane offset depends on: the sheet's top, the search
// field's bottom and the visible height (less the on-screen keyboard).
function phoneLayoutSignature() {
  const sheetTop = document.querySelector('#oc-result-pane')?.getBoundingClientRect().y
  const fieldBottom = document.querySelector('#oc-search-bar .oc-search-bar--field')?.getBoundingClientRect().bottom
  const visibleHeight = window.visualViewport?.height ?? window.innerHeight
  return [sheetTop, fieldBottom, visibleHeight].map((value) => (value === undefined ? '-' : Math.round(value))).join('|')
}

function hasSavedViewState(viewState) {
  return Number.isFinite(viewState?.longitude) && Number.isFinite(viewState?.latitude) && Number.isFinite(viewState?.zoom)
}

// mapRef: optional, for a parent that needs the map itself (e.g.
// CoordinatesMapPreview reading its center).
export default function OCMap({ mapRef: externalMapRef } = {}) {
  const internalMapRef = useRef()
  const mapRef = externalMapRef ?? internalMapRef
  // A small map inside a page (CoordinatesMapPreview, the edit pages): no pane
  // over it to make room for, and not the map page's view - it opens on the
  // edited cave and doesn't move the map page's remembered view.
  const embedded = Boolean(externalMapRef)
  const mapContainerRef = useRef()
  const currentMarkerRef = useRef()
  const { isSaved } = useSavedCaves()

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
  const viewResetRequested = useSelector((state) => state.map.viewResetRequested)
  const roles = useSelector((state) => state.session.roles)

  const { caveId } = useParams()
  const { setTitle: setPageTitle } = useTitle()
  const { t: tSeo } = useTranslation('seo')
  const previousCameraCaveIdRef = useRef(caveId)
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

  // A position in the URL (a shared link) wins over the last one seen here.
  const [hashViewState] = useState(locationViewState)
  const persistedViewStateAvailable = hasSavedViewState(savedViewState)
  // Neither (a first visit, or after the nav's Map item): the default view,
  // fitted to the home area's caves once they and the map have loaded.
  // (Not a link to a cave: it goes to the cave.)
  const [startsAtHome] = useState(() => !hashViewState && !persistedViewStateAvailable && !caveId)
  const [embeddedViewState] = useState(() => {
    const location = embedded && caveData.find((cave) => cave.id === caveId)?.location
    return location?.longitude != null ? { ...defaultViewState, longitude: location.longitude, latitude: location.latitude, zoom: EMBEDDED_ZOOM } : null
  })
  // Starting at home with the caves already there (from another page): framed
  // on them from the first frame. Opened on the default view and fitted after,
  // the map loaded that view's imagery, then jumped: its grey background
  // flashed while the new view's imagery came in.
  const [homeViewState] = useState(() => {
    const bounds = startsAtHome && !embedded && caveData.length > 0 ? homeBounds(caveData) : null
    return bounds ? { bounds, fitBoundsOptions: { padding: { top: 96, bottom: 40, left: 40, right: 96 }, maxZoom: 13 } } : null
  })
  const initialMapViewState = embeddedViewState ?? hashViewState ?? (persistedViewStateAvailable ? { ...defaultViewState, ...savedViewState } : (homeViewState ?? defaultViewState))

  const [currentCave, _setCurrentCave] = useState(_currentCave)
  const [hasInitialGoToMarker, setHasInitialGoToMarker] = useState(false)
  const [activeMarkerElem, doSetActiveMarkerElem] = useState()
  const [zoomLevel, setZoomLevel] = useState(initialMapViewState.zoom)
  const [isDraggingCurrentMarker, setIsDraggingCurrentMarker] = useState(false)
  const [mapBounds, setMapBounds] = useState()
  const [mapLoaded, setMapLoaded] = useState(false)
  // The map being dragged: the closed-hand cursor (the open one otherwise).
  const [isDragging, setIsDragging] = useState(false)

  const dispatch = useDispatch()

  const { t } = useTranslation('map')
  // Mapbox's own control labels (its buttons' names, its hints), in the app's
  // language - they stayed English.
  const mapLocale = useMemo(
    () => ({
      'GeolocateControl.FindMyLocation': t('geolocate.findMyLocation'),
      'GeolocateControl.LocationNotAvailable': t('controls.locationNotAvailable'),
      'Map.Title': t('controls.mapTitle'),
      'ScrollZoomBlocker.CtrlMessage': t('controls.scrollZoom'),
      'ScrollZoomBlocker.CmdMessage': t('controls.scrollZoomMac'),
      'TouchPanBlocker.Message': t('controls.touchPan'),
      'AttributionControl.ToggleAttribution': t('controls.toggleAttribution'),
      'LogoControl.Title': t('controls.logo'),
    }),
    [t],
  )

  const isSmall = useSmall()

  // react-map-gl/mapbox-gl only resize the canvas on window resize, not on
  // their own container resizing (e.g. a CSS-driven size change like the
  // cave edit page's enlarge toggle) - without this, the extra revealed
  // area after a container grows just stays blank.
  // Back on a map page (e.g. closing the /about dialog over the map): put the
  // position back in the URL. Also follow hand-edited hashes, as mapbox-gl's
  // `hash` option did.
  // (Not before load: the map isn't at its initial position yet.)
  useEffect(() => {
    if (mapLoaded) {
      writeMapHash(mapRef.current?.getMap())
    }
  }, [location.pathname, mapLoaded])

  useEffect(() => {
    function onHashChange() {
      const viewState = locationViewState()
      if (viewState) {
        mapRef.current?.jumpTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const filteredCaves = useMemo(() => {
    const filters = {
      coordinates: [(cave) => searchOptions.showValidCoordinates && cave.location.validity === 'valid', (cave) => searchOptions.showInvalidCoordinates && cave.location.validity === 'invalid', (cave) => searchOptions.showUnconfirmedCoordinates && cave.location.validity === 'unknown'],
      cenoteTypes: [(cave) => searchOptions.showCenoteEntrances !== false && !!cave.cenoteEntrance, (cave) => searchOptions.showOtherCenotes !== false && !cave.cenoteEntrance],
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

    // The open cave always has its pin, the filters aside: the search lists
    // every cave, and picking one the filters hide showed no pin (nor
    // anything to center on).
    const openCave = caveId && !result.some((cave) => cave.id === caveId) ? mapData?.find((cave) => cave.id === caveId) : null
    return openCave ? [...result, openCave] : result
  }, [mapData, searchOptions, caveId])

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
          // The form's validity, so the pin's icon follows its dropdown.
          ...(editFieldCoordinates.location.validity && { validity: editFieldCoordinates.location.validity }),
        },
      }
    })
  }, [filteredCaves, isWidePaneEditMode, editFieldCoordinates.location, caveId])

  const selectedCave = displayedCaves?.find((cave) => cave.id === caveId)

  // On first load the pins are revealed in batches, one per frame, instead
  // of all at once: rendering ~300 of them (React, then Mapbox placing each)
  // was one long block of main-thread work, during which the page couldn't
  // respond. The open cave's pin comes first, for flyToMarker. Once all are
  // shown, later updates (filters, panning) render them in full.
  const [markerLimit, setMarkerLimit] = useState(MARKER_REVEAL_BATCH)
  const allMarkersRevealed = markerLimit === Infinity
  const markerCount = displayedCaves?.length ?? 0
  useEffect(() => {
    if (allMarkersRevealed || markerCount === 0) return undefined
    if (markerLimit >= markerCount) {
      setMarkerLimit(Infinity)
      return undefined
    }
    const frame = requestAnimationFrame(() => setMarkerLimit((limit) => limit + MARKER_REVEAL_BATCH))
    return () => cancelAnimationFrame(frame)
  }, [markerLimit, markerCount, allMarkersRevealed])

  function revealedMarkers(caves) {
    if (allMarkersRevealed) return caves
    const current = caves.find((cave) => cave.id === caveId)
    const ordered = current ? [current, ...caves.filter((cave) => cave !== current)] : caves
    return ordered.slice(0, markerLimit)
  }
  const selectedCaveMarkerColor = selectedCave?.sistemas?.[selectedCave.sistemas.length - 1]?.color || SISTEMA_DEFAULT_COLOR

  function filterCaves(caves, filters) {
    function or(filters) {
      return function iteratee(result, item) {
        if (filters.some((filter) => filter(item))) {
          result.push(item)
        }
        return result
      }
    }

    return chain(caves).reduce(or(filters.coordinates), []).reduce(or(filters.cenoteTypes), []).reduce(or(filters.accesses), []).value()
  }

  // Stable for CaveMarker (memoized): they call this render's handlers.
  const markerHandlersRef = useRef()
  markerHandlersRef.current = { onMarkerClick, onFieldMarkerDragEnd }
  const handleMarkerClick = useCallback((event, cave) => markerHandlersRef.current.onMarkerClick(event, cave), [])
  const handleMarkerDragStart = useCallback(() => setIsDraggingCurrentMarker(true), [])
  const handleMarkerDragEnd = useCallback((event) => {
    setIsDraggingCurrentMarker(false)
    markerHandlersRef.current.onFieldMarkerDragEnd('location', event)
  }, [])

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
      _setCurrentCave(newCurrentCave)
      dispatch(setCurrentCaveInStore(newCurrentCave))
    }
  }

  function setActiveMarkerElem(markerElem, animate = false) {
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
    try {
      const map = mapRef.current
      if (!offsetForPane || embedded) {
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
        // Centered in the map left visible between the search bar's field
        // and the sheet. The field row only, not the whole bar: right after
        // picking a search result, its results list is still collapsing.
        // The sheet (and the search bar) may not be rendered yet on a direct
        // page load: count what's missing as 0 - flyToMarker then re-centers
        // once the sheet appears.
        const viewportBounding = document.querySelector('#root').getBoundingClientRect()
        const resultPaneBounding = document.querySelector('#oc-result-pane')?.getBoundingClientRect()
        const searchFieldBounding = document.querySelector('#oc-search-bar .oc-search-bar--field')?.getBoundingClientRect()

        const resultPaneHeight = resultPaneBounding ? viewportBounding.height - resultPaneBounding.y : 0
        // Slid off-screen (sheet fully up), the bar is above the top: 0.
        const searchFieldBottom = searchFieldBounding ? Math.max(0, searchFieldBounding.bottom) : 0

        centerPoint = currentPoint.add(new Point(0, (resultPaneHeight - searchFieldBottom) / 2))
      } else {
        // Keep in sync with ResultPaneLg.jsx's own `min(PANE_WIDTH * 2, 80vw)`
        // cap on its max-width in edit mode.
        const effectivePaneWidth = isWidePaneEditMode ? Math.min(PANE_WIDTH * 2, window.innerWidth * 0.8) : PANE_WIDTH
        centerPoint = currentPoint.sub(new Point(effectivePaneWidth / 2, 0))
      }

      const centerLngLat = map.unproject(centerPoint)

      return centerLngLat
    } catch (error) {
      console.error('Could not compute center lngLat from lng/lat [%o, %o]: %o', lng, lat, error)
    }
  }

  // Whether a point shows in the part of the map the pane and the search bar
  // leave visible, with a margin.
  function isInFreeArea({ longitude, latitude }) {
    const map = mapRef.current
    const container = mapContainerRef.current?.getBoundingClientRect()
    if (!map || !container) return false
    const { x, y } = map.project([longitude, latitude])
    const margin = 48
    if (isSmall) {
      const resultPaneTop = document.querySelector('#oc-result-pane')?.getBoundingClientRect().y ?? container.bottom
      const searchFieldBottom = document.querySelector('#oc-search-bar .oc-search-bar--field')?.getBoundingClientRect().bottom ?? 0
      return x >= margin && x <= container.width - margin && y >= Math.max(0, searchFieldBottom) + margin && y <= resultPaneTop - container.y - margin
    }
    const effectivePaneWidth = isWidePaneEditMode ? Math.min(PANE_WIDTH * 2, window.innerWidth * 0.8) : PANE_WIDTH
    return x >= effectivePaneWidth + margin && x <= container.width - margin && y >= margin && y <= container.height - margin
  }

  // Phone: the layout the offset was measured against is often still moving
  // - the sheet sliding in (or not rendered yet, on a direct load), the
  // keyboard closing after picking a search result, Ionic's sheet dropping
  // back down with it. Center again each time it settles into a new layout,
  // for a short while; a new centering, the user panning the map or the
  // cave being closed (or another one opened) ends it. Re-centering only
  // moves the camera: the cave's pin is already the active one.
  const settleTokenRef = useRef(0)
  const routeCaveIdRef = useRef(caveId)
  routeCaveIdRef.current = caveId
  function recenterWhenLayoutSettles(cave, measuredSignature) {
    const token = ++settleTokenRef.current
    const map = mapRef.current?.getMap()
    const stop = () => {
      if (token === settleTokenRef.current) settleTokenRef.current++
    }
    map?.once('dragstart', stop)
    const start = performance.now()
    let signature = measuredSignature
    let previous = measuredSignature
    let stableFrames = 0
    const step = () => {
      if (token !== settleTokenRef.current) return
      if (performance.now() - start > SETTLE_TIMEOUT || routeCaveIdRef.current !== cave.id) {
        map?.off('dragstart', stop)
        return
      }
      const current = phoneLayoutSignature()
      stableFrames = current === previous ? stableFrames + 1 : 0
      previous = current
      if (current !== signature && stableFrames >= SETTLE_FRAMES) {
        signature = current
        moveCameraTo(cave)
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  function moveCameraTo(cave, { animate = true, offsetForPane = true } = {}) {
    const center = getCenterLngLat(cave.location.longitude, cave.location.latitude, offsetForPane)
    const fn = animate ? 'flyTo' : 'jumpTo'

    mapRef.current?.[fn]({
      center,
      // Embedded: its own zoom, not the map page's.
      zoom: embedded ? mapRef.current.getZoom() : currentZoomLevel,
      ...(animate && {
        duration: theme.oc.sys.motion.duration.emphasized,
      }),
    })
  }

  function flyToMarker({ animate = true, cave = currentCave, offsetForPane = true } = {}) {
    if (cave && cave.location) {
      if (isSmall && offsetForPane) {
        recenterWhenLayoutSettles(cave, phoneLayoutSignature())
      }
      const { longitude: lng, latitude: lat } = cave.location
      const currentMarker = mapRef.current?.getMap()._markers.find((marker) => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === lng && markerLngLat.lat === lat
      })

      if (currentMarker) {
        setActiveMarkerElem(currentMarker.getElement(), true)
      }

      moveCameraTo(cave, { animate, offsetForPane })
    }
  }

  function flyToCoordinate(lng, lat) {
    const center = getCenterLngLat(lng, lat, true)

    mapRef.current?.flyTo({
      center,
      zoom: embedded ? mapRef.current.getZoom() : currentZoomLevel,
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
    setIsDragging(false)
    // Set current map bounds
    updateMapBounds()
  }

  const onMove = debounce(function (event) {
    if (!embedded) dispatch(setViewState(event.viewState))
  }, 300)

  function onMoveEnd() {
    // Set current map bounds
    updateMapBounds()
    writeMapHash(mapRef.current?.getMap())
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
    setMapLoaded(true)
    writeMapHash(mapRef.current?.getMap())

    // Set initial map bounds
    setMapBounds()

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
      longitude: num(event.lngLat.lng, COORDINATE_DECIMALS),
      latitude: num(event.lngLat.lat, COORDINATE_DECIMALS),
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
      longitude: num(lngLat.lng, COORDINATE_DECIMALS),
      latitude: num(lngLat.lat, COORDINATE_DECIMALS),
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
      longitude: num(event.lngLat.lng, COORDINATE_DECIMALS),
      latitude: num(event.lngLat.lat, COORDINATE_DECIMALS),
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
    console.log('==== currentCave: ', currentCave)
  }, [currentCave])

  /**
   * IGNORE END
   */

  /*
   * Initialisation
   */

  // The map's own title whenever no cave is open (a cave's pane sets its
  // own). This used to call the action creator without dispatching it, so
  // the previous page's title lingered.
  useEffect(() => {
    if (!caveId) {
      setPageTitle(tSeo('mapTitle'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caveId, tSeo])

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
      // In the store too: /map can be reached without closing the cave -
      // browser Back, the app bar's Home, a link - and the search bar shows
      // the store's cave (a no-op when it's already cleared).
      dispatch(clearCurrentCave())
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
    if (!caveId) {
      // Closed: picking the same cave again is a new selection.
      previousCameraCaveIdRef.current = null
    }
    if (!mapLoaded || !caveId) {
      return
    }

    const routeCave = caveData.find((cave) => cave.id === caveId)
    if (!routeCave) {
      return
    }

    const caveRouteChanged = previousCameraCaveIdRef.current !== caveId
    previousCameraCaveIdRef.current = caveId

    // Closing a cave (the search bar's clear, the pane's close) clears it
    // from Redux just before the route leaves it: not a new selection - flying
    // there again would re-activate its pin, only to deactivate it right after.
    if (!caveRouteChanged && !_currentCave) {
      return
    }

    // A newly selected route must fly even if Redux already holds this cave.
    // A reload keeps the remembered view - unless the pin isn't in sight in
    // it (the map was moved away from it before this link was opened).
    if (persistedViewStateAvailable && _currentCave?.id === caveId && !caveRouteChanged && routeCave.location && isInFreeArea(routeCave.location)) {
      const currentMarker = mapRef.current?.getMap()._markers.find((marker) => {
        const markerLngLat = marker.getLngLat()
        return markerLngLat.lng === routeCave.location.longitude && markerLngLat.lat === routeCave.location.latitude
      })

      if (currentMarker) {
        setActiveMarkerElem(currentMarker.getElement(), true)
      }

      return
    }
    if (routeCave.location) {
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
    // isSmall too: switching between the phone and desktop layouts (a resize,
    // or useSmall settling after its first render reports desktop) moves the
    // pane from the side to the bottom, so the offset computed before is wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWidePaneEditMode, isSmall])

  // The default view: the home area's caves, framed clear of the search bar
  // (homeBounds; the hard-coded center and zoom showed a different area on
  // each screen size).
  const caveBounds = useMemo(() => homeBounds(caveData), [caveData])
  function fitHome(animate) {
    const map = mapRef.current
    if (!map || !caveBounds) return false
    map.fitBounds(caveBounds, { padding: { top: isSmall ? 88 : 96, bottom: 40, left: 40, right: isSmall ? 40 : 96 }, maxZoom: 13, ...(animate ? { essential: false } : { duration: 0 }) })
    return true
  }

  // A first visit: framed on the caves as soon as they're there.
  const fittedHomeRef = useRef(false)
  useEffect(() => {
    // 'fresh': just framed - a reset request that opened the map is done.
    if (startsAtHome && !fittedHomeRef.current && mapLoaded && fitHome(false)) fittedHomeRef.current = 'fresh'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAtHome, mapLoaded, caveBounds])

  // The nav's Map item while the map is open: back to the default view.
  // (Opening the map, it starts there: resetView cleared the saved view.)
  useEffect(() => {
    // Opened by it: the map starts at home already (startsAtHome), no flight.
    if (viewResetRequested && startsAtHome && !fittedHomeRef.current) return
    if (viewResetRequested && startsAtHome && fittedHomeRef.current === 'fresh') {
      fittedHomeRef.current = true
      dispatch(clearViewResetRequest())
      return
    }
    if (viewResetRequested && mapLoaded && fitHome(true)) dispatch(clearViewResetRequest())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewResetRequested, mapLoaded, caveBounds])

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

  // No region of its own: Mapbox's canvas is one, named (mapLocale's Map.Title).
  return (
    <Box className="oc-map oc-map-container" ref={mapContainerRef}>
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
          <Map ref={mapRef} {...MAP_PROPS} locale={mapLocale} mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN} initialViewState={initialMapViewState} cursor={pickingCoordinateFor ? 'crosshair' : isDragging ? 'grabbing' : 'grab'} onClick={onMapClick} onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd} onMove={onMove} onMoveEnd={onMoveEnd} onZoom={onZoom} onZoomEnd={onZoomEnd} onLoad={onLoad} transformRequest={caveTileRequest}>
            <CaveLayer selectedSistemaId={selectedCave?.sistemaId} />
            <PlaceOnMapOverlay mapRef={mapRef} />
            <GeolocateControl
              positionOptions={{ enableHighAccuracy: true }}
              // trackUserLocation={true}
              position="bottom-right"
              onError={onGeolocateError}
            />
            {/* Its label as the map's other buttons' tooltip, translated. */}
            {mapLoaded && <GeolocateTooltip mapContainer={mapRef.current?.getMap().getContainer()} />}

            {/* 'location' isn't rendered here - it's the same point as the
                current cave's own marker below, which becomes draggable
                instead of duplicating it with a second pin. */}
            {isWidePaneEditMode &&
              Object.entries(editFieldCoordinates)
                .filter(([field]) => field !== 'location')
                .map(([field, { longitude, latitude }]) => {
                  const badgeIcon = EDIT_FIELD_BADGE_ICONS[field]

                  return (
                    <Marker key={`edit-field-${field}`} ref={labelMarker(t(`markers.${field}`))} longitude={longitude} latitude={latitude} anchor="bottom" draggable onDragEnd={(event) => onFieldMarkerDragEnd(field, event)}>
                      {/* .marker-icon's own cursor:pointer would otherwise win over sx - force the open-hand grab cursor. */}
                      <Box className="oc-map--marker-icon marker-icon" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab !important', width: 28, height: 28 }}>
                        {badgeIcon ? (
                          <PinBadgeIcon size={28} overlay={badgeIcon} />
                        ) : (
                          <SvgIcon inheritViewBox htmlColor={theme.palette.secondary.main} sx={{ width: '100%', height: '100%' }}>
                            <PinIcon />
                          </SvgIcon>
                        )}
                      </Box>
                    </Marker>
                  )
                })}

            {selectedCave && !isWidePaneEditMode && selectedCave.entrance && (
              <Marker key={`selected-entrance-${selectedCave.id}`} ref={labelMarker(t('markers.entrance'))} longitude={selectedCave.entrance.longitude} latitude={selectedCave.entrance.latitude} anchor="top" offset={POINT_ICON_OFFSET} className="active-animate" style={{ pointerEvents: 'none' }}>
                {/* The icon alone (no pin), in the cave's pin colour, its name under it. */}
                <Box className="oc-map--marker marker" sx={POINT_SX}>
                  <FenceRounded className="oc-map--marker-icon marker-icon" sx={{ ...POINT_ICON_SX, color: selectedCaveMarkerColor }} />
                  <div className="oc-map--marker-label marker-label">{t('markers.entranceShort')}</div>
                </Box>
              </Marker>
            )}
            {selectedCave &&
              !isWidePaneEditMode &&
              selectedCave.keys?.map((key, index) => (
                <Marker key={`selected-key-${selectedCave.id}-${index}`} ref={labelMarker(t('markers.key'))} longitude={key.longitude} latitude={key.latitude} anchor="top" offset={POINT_ICON_OFFSET} className="active-animate" style={{ pointerEvents: 'none' }}>
                  <Box className="oc-map--marker marker" sx={POINT_SX}>
                    <VpnKeyRounded className="oc-map--marker-icon marker-icon" sx={{ ...POINT_ICON_SX, color: selectedCaveMarkerColor }} />
                    <div className="oc-map--marker-label marker-label">{t('markers.keyShort')}</div>
                  </Box>
                </Marker>
              ))}

            {revealedMarkers(
              (displayedCaves || []).filter(({ location }) => {
                const lngLat = new LngLat(location.longitude, location.latitude)
                return mapBounds ? mapBounds.contains(lngLat) : true
              }),
            ).map((cave) => {
              const current = caveId === cave.id
              const draggable = current && isWidePaneEditMode
              return (
                <CaveMarker
                  key={`m-${cave.id}`}
                  cave={cave}
                  current={current}
                  draggable={draggable}
                  // Only the dragged pin: the others don't re-render.
                  dragging={draggable && isDraggingCurrentMarker}
                  // Its name: zoomed in enough, or the open cave's pin while its
                  // in-place edit form (and this pin's draggability) is active.
                  showLabel={zoomLevel > MARKER_CONFIG.label.minZoomLevel || draggable}
                  saved={isSaved(cave.id)}
                  editMode={isWidePaneEditMode}
                  replace={currentRoute.id === 'result-pane'}
                  onMarkerClick={handleMarkerClick}
                  onDragStart={handleMarkerDragStart}
                  onDragEnd={handleMarkerDragEnd}
                />
              )
            })}
          </Map>
        </Box>
      </Fade>
    </Box>
  )
}
