import { Helmet, HelmetProvider } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Fragment, useEffect } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles, InitColorSchemeScript } from '@mui/material'
import { getRouter } from './router.jsx'
import SnackbarProvider from '@/components/Snackbar/SnackbarProvider.jsx'
import OfflineMediaSync from '@/components/Offline/OfflineMediaSync.jsx'
import PendingUploadsSync from '@/components/Offline/PendingUploadsSync.jsx'
import ConnectionSnackbar from '@/components/Offline/ConnectionSnackbar.jsx'
import { subscribeToData } from '@/services/data-service.jsx'
import { isInstalledApp, requestPersistentStorage } from '@/utils/persistentStorage.js'
import { setDataLoadingState } from '@/redux/slices/dataSlice.jsx'
import TitleBar from '@/components/App/TitleBar.jsx'
import ManageAppUpdate from '@/components/App/ManageAppUpdate.jsx'
import ManageAuth from '@/components/auth/ManageAuth.jsx'
import AccountLinking from '@/components/auth/AccountLinking.jsx'
import Splash from '@/components/utils/Splash.jsx'
import getDevicePixelRatio from '@/utils/getDevicePixelRatio.js'
import { removeShell } from '@/utils/shell.js'
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

// (Not on the server, which renders the public pages: entry-server.jsx.)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.setProperty('--oc-device-pixel-ratio', getDevicePixelRatio())
  })
}

// serverRouter: on the server, its static router (entry-server.jsx), in
// place of the browser's.
const App = ({ serverRouter = null }) => {
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

  // index.html's splash stays over the app through every loading state, until
  // the page it stands for has rendered: the map's search bar (SearchBar),
  // another page's Layout, or an error page (NoMatch) removes it. Anything
  // else (a dev page...): gone after a while, so it can never stay stuck.
  useEffect(() => {
    const timer = setTimeout(removeShell, 8000)
    return () => clearTimeout(timer)
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
            {serverRouter || <RouterProvider router={getRouter()} />}
            <OfflineMediaSync />
            {/* Photos and maps added offline, uploaded once on Wi-Fi. */}
            <PendingUploadsSync />
            {/* Going offline or back online: said in a snackbar. */}
            <ConnectionSnackbar />
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
