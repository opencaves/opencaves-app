import { MapLoading } from '@/components/Map/MapState.jsx'
import SearchBarMockup from '@/components/SearchBar/SearchBarMockup.jsx'

// The router's loading screen (HydrateFallback, and lazy routes). On map
// routes it keeps the search bar in place - as index.html's shell drew it,
// and as the map page will - instead of the bar vanishing until the map
// page renders. Other pages: nothing - index.html's page splash stays over
// them until Layout renders (the /loading preview aside), no map screen.
export default function Loading() {
  const path = window.location.pathname
  const isMapRoute = path === '/map' || path.startsWith('/map/')

  if (!isMapRoute && path !== '/loading') return null

  return (
    <>
      <MapLoading className="oc-loading" />
      {isMapRoute && <SearchBarMockup />}
    </>
  )
}
