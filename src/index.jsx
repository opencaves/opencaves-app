import React, { StrictMode } from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom/client'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from '@/redux/store.jsx'
import App from './App.jsx'
import Profiler from '@/components/utils/Profiler.jsx'
import i18n from './i18n.js'
import { loadMatchedLazyRoutes } from './router.jsx'
import { setHydrating } from '@/ssr/ssrContext.js'
import HydrationDone from '@/ssr/HydrationDone.jsx'
import { isPhone, loadIonic } from '@/utils/loadIonic.js'
// Drags of the page's own pictures never start the "drop to add" process.
import '@/utils/externalFileDrag.js'
// import reportWebVitals from './reportWebVitals'

// Ionic is for phones only (see utils/ionic.js), and only the map uses it:
// fetched right away when the map is the page opened; other pages get it
// with the map's prefetch, once they've loaded (prefetchMap) - it was 219 KB
// competing with every phone page's own code.
if (isPhone() && /^\/map(\/|$)/.test(window.location.pathname)) {
  loadIonic()
}

// A page the server rendered (entry-server.jsx: the public pages, in
// English) is hydrated - the app takes over the server's HTML - when the
// browser shows it in the same language, at the same address. Its first
// render must be the server's: the server's data (the store's preloaded
// state, store.jsx), no PersistGate (it renders nothing until the stored
// state is read; that state comes in after). Elsewhere, or in another
// language, the app renders as it always has.
const ssr = window.__OC_SSR__
const hydrate = Boolean(ssr) && ssr.path === window.location.pathname && i18n.resolvedLanguage === ssr.language
const container = document.getElementById('root')

// In a build, index.html's loader adds the app's stylesheets next to this
// script, after the page's first paint (see vite.config.js): render once
// they're in, so nothing shows unstyled. (No such promise in dev.)
if (hydrate) {
  setHydrating(true)
  // The page's lazy routes loaded first, as the server had them (router.jsx).
  Promise.all([window.__ocAppStylesheets, loadMatchedLazyRoutes()]).then(() => {
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
  })
} else {
  // (The stored state waited for a hydration: read now.)
  if (ssr) persistor.persist()
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

// Google Tag Manager has no bearing on the app being usable - load and
// initialize it once the browser is idle instead of having it compete with
// the app's own bundle for bandwidth and parse time during initial load.
function initTagManager() {
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
afterLoad(initTagManager, 4000)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log)