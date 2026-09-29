import { Suspense, lazy, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { MapLoading } from '@/components/Map/MapState.jsx'
import SearchBar from '@/components/SearchBar/SearchBar.jsx'
import FilterMenu from '@/components/Map/FilterMenu.jsx'
import AppMenu from '@/components/App/AppMenu.jsx'
import EditCaveFab from '@/components/Map/EditCaveFab.jsx'
import MapLegalLinks from '@/components/Map/MapLegalLinks.jsx'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import Dev from '@/components/utils/Dev.jsx'
import { isPhone, loadIonic } from '@/utils/loadIonic.js'
import './Map.scss'

// mapbox-gl/react-map-gl are ~500KB (compressed) on their own and were
// imported statically at the top of components/Map/Map.jsx alongside its
// own MapLoading spinner - meaning that whole bundle had to finish
// downloading and evaluating before the spinner could render at all, even
// though the spinner itself doesn't need any of it. Loading it lazily lets
// the (already-bundled, tiny) spinner below paint immediately instead.
const Map = lazy(() => import('@/components/Map/Map.jsx'))

// On phones the page sits in Ionic's IonApp (for the result pane's sheet);
// elsewhere a plain div, so desktop never loads Ionic (see utils/ionic.js).
const IonApp = lazy(() => loadIonic().then(({ IonApp }) => ({ default: IonApp })))

export default function MapPage() {
  const theme = useTheme()
  const isLarge = useMediaQuery(theme.breakpoints.up('sm'))
  const { t } = useTranslation('seo')
  const { caveId } = useParams()
  // Decided once, at mount: switching wrappers later (a resized window)
  // would remount the whole map.
  const [PageRoot] = useState(() => (isPhone() ? IonApp : 'div'))

  return (
    <Suspense fallback={null}>
    <PageRoot className="oc-map">
      <AddMediasProvider>
        {/* The page's h1 (for search engines and screen readers); the map is
            its own visual heading. While a cave is open, its name is the h1. */}
        {!caveId && (
        <Box component="h1" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
          {t('mapHeading')}
        </Box>
        )}
        <SearchBar />
        <Suspense fallback={<MapLoading />}>
          <Map />
        </Suspense>
        <FilterMenu />
        <EditCaveFab />
        <MapLegalLinks />
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
    </PageRoot>
    </Suspense>
  )
}
