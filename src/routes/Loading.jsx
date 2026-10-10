import { useLayoutEffect } from 'react'
import { MapLoading } from '@/components/Map/MapState.jsx'
import SearchBarMockup from '@/components/SearchBar/SearchBarMockup.jsx'
import { removeShell } from '@/utils/shell.js'

/**
 * The router's loading screen (HydrateFallback, and lazy routes). On map
 * routes it keeps the search bar in place - as index.html's shell drew it,
 * and as the map page will - instead of the bar vanishing until the map
 * page renders. Other pages: nothing - index.html's page splash stays over
 * them until Layout renders (the /loading preview aside), no map screen.
 */
export default function Loading() {
  const path = window.location.pathname
  const isMapRoute = path === '/map' || path.startsWith('/map/')

  // On the map, this is index.html's splash drawn by the app (its styles
  // loaded): the splash can go, ~3 s sooner than the map page renders on a
  // slow connection, and nothing changes on screen.
  useLayoutEffect(() => {
    if (isMapRoute) removeShell()
  }, [isMapRoute])

  if (!isMapRoute && path !== '/loading') return null

  return (
    <>
      <MapLoading className="oc-loading" />
      {isMapRoute && <SearchBarMockup />}
    </>
  )
}
