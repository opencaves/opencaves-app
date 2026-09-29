import { MapLoading } from '@/components/Map/MapState.jsx'
import SearchBarMockup from '@/components/SearchBar/SearchBarMockup.jsx'

// The router's loading screen (HydrateFallback, and lazy routes). On map
// routes it keeps the search bar in place - as index.html's shell drew it,
// and as the map page will - instead of the bar vanishing until the map
// page renders.
export default function Loading() {
  const path = window.location.pathname
  const isMapRoute = path === '/' || path === '/map' || path.startsWith('/map/')

  return (
    <>
      <MapLoading className="oc-loading" />
      {isMapRoute && <SearchBarMockup />}
    </>
  )
}
