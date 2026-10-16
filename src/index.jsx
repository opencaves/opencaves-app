import React, { StrictMode } from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom/client'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from '@/redux/store.jsx'
import App from './App.jsx'
import Profiler from '@/components/utils/Profiler.jsx'
import i18n, { languageReady } from './i18n.js'
import { loadMatchedLazyRoutes } from './router.jsx'
import { setHydrating } from '@/ssr/ssrContext.js'
import HydrationDone from '@/ssr/HydrationDone.jsx'
// Drags of the page's own pictures never start the "drop to add" process.
import '@/utils/externalFileDrag.js'
import { watchFirestoreFailures } from '@/utils/firestoreRecovery.js'
import { watchStaleBuild } from '@/utils/staleBuild.js'
import { watchFocusRestore } from '@/utils/restoreFocus.js'
import { deferFirebase, loadFirebase } from '@/utils/loadFirebase.js'
import { analyticsAllowed, applyAnalyticsOptOut } from '@/utils/analytics.js'
import { track } from '@/utils/track.js'

// Firestore's internal failures, recovered rather than left on the error page.
watchFirestoreFailures()

// A page from before a deploy, failing to load the old build's code: reloaded
// for the new one (utils/staleBuild.js).
watchStaleBuild()

// A dialog or menu closed: the focus back where it was (utils/restoreFocus.js).
watchFocusRestore()
window.addEventListener('appinstalled', () => track('app_install'))

// A page the server rendered (entry-server.jsx: the public pages, in
// English) is hydrated - the app takes over the server's HTML - when the
// browser shows it in the same language, at the same address. Its first
// render must be the server's: the server's data (the store's preloaded
// state, store.jsx, and the page's cave data, useCaveData), no PersistGate (it renders nothing until the stored
// state is read; that state comes in after). Elsewhere, or in another
// language, the app renders as it always has.
// The visitor's language first (i18n.js: only English is in the app, the
// others are a file each): whether the page hydrates depends on it.
languageReady.then(start, start)

function start() {
  const ssr = window.__OC_SSR__
  const hydrate = Boolean(ssr) && ssr.path === window.location.pathname && i18n.resolvedLanguage === ssr.language
  const container = document.getElementById('root')

  // Firebase (utils/loadFirebase.js): a page the server rendered has its
  // content and data in its HTML - Firebase waits for the person's first
  // interaction, or a few seconds after the page's load. Any other page needs
  // it at once (the cave data, the session): fetched now, beside the app.
  if (hydrate) deferFirebase()
  else loadFirebase().catch((error) => console.error('[firebase] not loaded: %o', error))

  // In a build, index.html's loader adds the app's stylesheets next to this
  // script, after the page's first paint (see vite.config.js): render once
  // they're in, so nothing shows unstyled. (No such promise in dev.)
  function render() {
    const root = ReactDOM.createRoot(container)
    Promise.resolve(window.__ocAppStylesheets).then(() => root.render(
      // <StrictMode>
      <Profiler name='App'>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </Profiler>
      // </StrictMode >
    ))
  }

  if (hydrate) {
    setHydrating(true)
    // The page's lazy routes loaded first, as the server had them (router.jsx).
    Promise.all([window.__ocAppStylesheets, loadMatchedLazyRoutes()]).then(
      () => {
        // useSelector's server snapshot: the state the server rendered with,
        // whatever comes in (the stored state) while the page hydrates.
        const serverState = store.getState()
        ReactDOM.hydrateRoot(
          container,
          <Profiler name='App'>
            <Provider store={store} serverState={serverState}>
              <App />
              <HydrationDone />
            </Provider>
          </Profiler>,
          {
            // A difference with the server's HTML: said in the console (React
            // then renders that part anew).
            onRecoverableError: (error, info) => console.warn('[hydrate] %o %s', error, info?.componentStack || ''),
          },
        )
      },
      // Its route's code not loaded (offline...): the app renders the page itself.
      (error) => {
        console.error('[hydrate] %o', error)
        setHydrating(false)
        persistor.persist()
        render()
      },
    )
  } else {
    // (The stored state waited for a hydration: read now.)
    if (ssr) persistor.persist()
    render()
  }
}

// Google Tag Manager has no bearing on the app being usable - load and
// initialize it once the browser is idle instead of having it compete with
// the app's own bundle for bandwidth and parse time during initial load.
// Only for the real site's visitors (utils/analytics.js): not the dev server,
// previews, automated browsers or a device that opted out (?no-analytics).
function initTagManager() {
  if (!analyticsAllowed()) return
  import('react-gtm-module').then(({ default: TagManager }) => {
    TagManager.initialize({ gtmId: 'GTM-WBL7VM3' })
  })
}

// Idle alone came within a second on a slow phone, in the middle of loading:
// a few seconds after the page's load, then when idle.
function afterLoad(run, delay) {
  const later = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 5000 }) : run()), delay)
  if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
}
applyAnalyticsOptOut()
afterLoad(initTagManager, 4000)
