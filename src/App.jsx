import { Helmet, HelmetProvider } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Fragment, useEffect } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles, InitColorSchemeScript } from '@mui/material'
import router from './router.jsx'
import SnackbarProvider from '@/components/Snackbar/SnackbarProvider.jsx'
import OfflineMediaSync from '@/components/Offline/OfflineMediaSync.jsx'
import { subscribeToData } from '@/services/data-service.jsx'
import { isInstalledApp, requestPersistentStorage } from '@/utils/persistentStorage.js'
import { setDataLoadingState } from '@/redux/slices/dataSlice.jsx'
import TitleBar from '@/components/App/TitleBar.jsx'
import ManageAppUpdate from '@/components/App/ManageAppUpdate.jsx'
import ManageAuth from '@/components/auth/ManageAuth.jsx'
import AccountLinking from '@/components/auth/AccountLinking.jsx'
import Splash from '@/components/utils/Splash.jsx'
import getDevicePixelRatio from '@/utils/getDevicePixelRatio.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { theme } from '@/theme/Theme.jsx'
import { APP_TITLE } from '@/config/app.js'

import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'

// /* Theme variables */
import './theme/variables.scss'

import './App.scss'

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.setProperty('--oc-device-pixel-ratio', getDevicePixelRatio())
})

const App = () => {
  const dispatch = useDispatch()
  const store = useStore()
  const { title } = useTitle()
  const { i18n } = useTranslation()

  useEffect(() => {
    // Return visits: the cave data is already restored from storage
    // (redux-persist, before App renders - PersistGate), so the map shows it
    // right away, and the live subscription - Firestore's cache work plus
    // reprocessing and re-rendering ~900 caves - waits until the browser is
    // idle instead of competing with the first render. First visits have
    // nothing to show yet: subscribe right away.
    const hasStoredData = store.getState().data.caves.length > 0
    dispatch(setDataLoadingState({ state: hasStoredData ? 'loaded' : 'loading' }))

    let unsubscribe = null
    const subscribe = () => {
      unsubscribe = subscribeToData(
        () => dispatch(setDataLoadingState({ state: 'loaded' })),
        (error) => {
          console.error('[subscribeToData] %o', error)
          dispatch(setDataLoadingState({ state: 'error', error }))
        },
      )
    }

    if (!hasStoredData) {
      subscribe()
      return () => unsubscribe?.()
    }
    const idle = 'requestIdleCallback' in window
    const handle = idle ? requestIdleCallback(subscribe, { timeout: 3000 }) : setTimeout(subscribe, 1500)
    return () => {
      if (idle) cancelIdleCallback(handle)
      else clearTimeout(handle)
      unsubscribe?.()
    }
  }, [dispatch, store])

  // index.html's static map shell stays under the app until the real search
  // bar replaces it (SearchBar) - through every loading state in between.
  // Only a page that isn't the map (a redirect, an error page) removes it
  // here, since no search bar will.
  useEffect(() => {
    const path = window.location.pathname
    if (!(path === '/' || path === '/map' || path.startsWith('/map/'))) {
      document.getElementById('oc-shell')?.remove()
    }
  }, [])

  useEffect(() => {
    if (isInstalledApp()) {
      requestPersistentStorage()
    }
  }, [])

  return (
    <Fragment>
      <InitColorSchemeScript defaultMode="light" />
      <ThemeProvider theme={theme}>
        <Splash />
        <GlobalStyles
          styles={(theme) => ({
            ':root': {
              ...Object.entries(theme.transitions.duration).reduce(
                (styles, style) => ({
                  ...styles,
                  [`--${theme.cssVarPrefix}-transition-duration-${style[0]}`]: `${style[1]}ms`,
                }),
                {},
              ),
            },
          })}
        />
        <CssBaseline />
        <HelmetProvider>
          {/* lang follows the UI language (index.html's static "en" is only
              the pre-render fallback), for search engines and screen readers. */}
          <Helmet defaultTitle={APP_TITLE} htmlAttributes={{ lang: i18n.resolvedLanguage }}>
            <title>{title}</title>
          </Helmet>
          <TitleBar />
          <SnackbarProvider>
            <RouterProvider router={router} />
            <OfflineMediaSync />
            <AccountLinking />
          </SnackbarProvider>
          <ManageAppUpdate />
          <ManageAuth />
        </HelmetProvider>
      </ThemeProvider>
    </Fragment>
  )
}

export default App
