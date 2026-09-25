import { Suspense, lazy } from 'react'
import { Outlet } from 'react-router-dom'
import { IonApp } from '@ionic/react'
import { useMediaQuery, useTheme } from '@mui/material'
import { MapLoading } from '@/components/Map/MapState.jsx'
import SearchBar from '@/components/SearchBar/SearchBar.jsx'
import FilterMenu from '@/components/Map/FilterMenu.jsx'
import AppMenu from '@/components/App/AppMenu.jsx'
import EditCaveFab from '@/components/Map/EditCaveFab.jsx'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import Dev from '@/components/utils/Dev.jsx'
import './Map.scss'

// mapbox-gl/react-map-gl are ~500KB (compressed) on their own and were
// imported statically at the top of components/Map/Map.jsx alongside its
// own MapLoading spinner - meaning that whole bundle had to finish
// downloading and evaluating before the spinner could render at all, even
// though the spinner itself doesn't need any of it. Loading it lazily lets
// the (already-bundled, tiny) spinner below paint immediately instead.
const Map = lazy(() => import('@/components/Map/Map.jsx'))

export default function MapPage() {
  const theme = useTheme()
  const isLarge = useMediaQuery(theme.breakpoints.up('sm'))

  return (
    <IonApp className="oc-map">
      <AddMediasProvider>
        <SearchBar />
        <Suspense fallback={<MapLoading />}>
          <Map />
        </Suspense>
        <FilterMenu />
        <EditCaveFab />
        {isLarge && (
          <AppMenu
            logoColorScheme="light"
            logoSx={{
              width: '28px',
              height: '28px',
            }}
            sx={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '40px',
              height: '40px',
              p: 0,
              '> .MuiSvgIcon-root': {
                fontSize: '32px',
              },
            }}
          />
        )}
        <Outlet />
        <Dev
          sx={{
            '--oc-mode-switcher-right': isLarge ? 'calc(40px + 2rem)' : '.5rem',
            '--oc-mode-switcher-top': isLarge ? '1rem' : 'calc(48px + 1rem)',
          }}
        />
      </AddMediasProvider>
    </IonApp>
  )
}
