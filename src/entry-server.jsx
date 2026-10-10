import { renderToString } from 'react-dom/server'
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import i18n from './i18n.js'
import App from './App.jsx'
import Profiler from './components/utils/Profiler.jsx'
import HydrationDone from './ssr/HydrationDone.jsx'
import { routes } from './routeTree.jsx'
import { createServerStore } from './redux/store.server.jsx'
import { setServerContext } from './ssr/ssrContext.js'
import { buildPageState, fullPageData, pageOf } from './ssr/pageState.js'

// The server's rendering of the public pages - /, /caves, /caves/<id>,
// /sistemas, /sistemas/<id> - with the app's own components (built by `vite
// build --ssr`, run by functions/js/seo/ssr.js): the page's HTML, the
// Emotion styles it uses, and what the browser needs to render the same
// page again and take it over (index.jsx hydrates it): the cave data it shows
// and the query results (ssrContext.js), and the router's state. In English (the
// pages' language for search engines); a browser in another language renders
// the page anew (index.jsx). The map (/map...) isn't rendered here: Mapbox
// draws in the browser only.

// The page's address as one of the server-rendered pages, or null.
export { pageOf }

// Each page's route module (routeTree.jsx's lazy imports), by its kind
// (pageOf): the server preloads its code (functions/js/seo/ssr.js, from the
// client build's manifest).
export const ROUTE_MODULES = {
  home: 'src/routes/Home.jsx',
  caves: 'src/routes/caves/CaveIndex.jsx',
  cave: 'src/routes/caves/CavePage.jsx',
  sistemas: 'src/routes/sistemas/SistemaIndex.jsx',
  sistema: 'src/routes/sistemas/SistemaPage.jsx',
}

/**
 * @param {object} options
 * @param {string} options.url - The page's full address (its host decides the emulators' file
 *   addresses: localhost).
 * @param {CaveData} options.raw - With maps and assets: the data (pageState.js).
 * @param {{id: string, data: CaveMap}[]} options.maps - The maps collection ([{ id, data }]).
 * @param {{id: string, data: object}[]} options.assets - The page's cave's photos ([{ id, data }]).
 * @param {string} options.title - The page's <title> (the server's, functions/js/seo), the app's own title
 *   (App's Helmet) until the page sets it.
 * @returns {Promise<object>} { html, styles, status, ssr } or { notFound: true }.
 */
export async function render({ url, raw, maps, assets, title }) {
  const started = performance.now()
  const { pathname, hostname } = new URL(url)
  const page = pageOf(pathname)
  if (!page) return { notFound: true }
  const { data, queries, found } = buildPageState(page, { raw, maps, assets })
  if (!found) return { notFound: true }
  // The store: the app's title (the cave data is useCaveData's).
  const state = title ? { app: { ...createServerStore().getState().app, title } } : {}

  const dataReady = performance.now()
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en')
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request(url))
  if (context instanceof Response) return { notFound: true }
  const router = createStaticRouter(handler.dataRoutes, context)

  // The page drawn with pageData (state.data's shape, useCaveData), and the
  // Emotion styles it used.
  const draw = (pageData) => {
    const store = createServerStore(state)
    // The browser's Emotion cache has the same key (MUI's default, "css"):
    // it takes these styles over instead of inserting them again.
    const cache = createCache({ key: 'css' })
    // Made before the render: it sets the cache to keep the styles for
    // extracting (compat), instead of writing them in the HTML.
    const emotionServer = createEmotionServer(cache)
    // One page at a time: rendering is synchronous, the context set around it.
    setServerContext({ hostname, queries, data: { path: pathname, data: pageData } })
    try {
      return {
        emotionServer,
        html: renderToString(
          // The browser's tree (index.jsx's hydrateRoot), element for element:
          // useId's ids (MUI's) come from it.
          <CacheProvider value={cache}>
            <Profiler name='App'>
              <Provider store={store}>
                <App serverRouter={<StaticRouterProvider router={router} context={context} hydrate={false} />} />
                <HydrationDone />
              </Provider>
            </Profiler>
          </CacheProvider>,
        ),
      }
    } finally {
      setServerContext(null)
    }
  }

  const renderStarted = performance.now()
  let pageData = data
  let { html, emotionServer } = draw(pageData)
  const rendered = performance.now()
  // The same page drawn with every record, as the browser draws it once it
  // has them all: the same HTML, or the page's data missed something it
  // shows (pageState.js) - then sent whole (a bigger page, but no change on
  // the screen when the rest comes).
  const full = fullPageData(raw)
  const check = draw(full)
  if (check.html !== html) {
    console.warn('[ssr] %s: drawn differently with its part of the data - sent whole', pathname)
    ;({ html, emotionServer } = check)
    pageData = full
  }
  const checked = performance.now()
  // React puts the <title> it renders (App's Helmet) first: the page's
  // <head> has it already (functions/js/seo/shared.js), and the browser's
  // React adds its own to <head> - not one in the page's body as well.
  html = html.replace(/^<title>[^<]*<\/title>/, '')
  const styles = emotionServer.constructStyleTagsFromChunks(emotionServer.extractCriticalToChunks(html))
  return {
    html,
    styles,
    status: context.statusCode,
    // How long each part took (ms), for the function's logs.
    timings: { data: Math.round(dataReady - started), render: Math.round(rendered - renderStarted), check: Math.round(checked - rendered), styles: Math.round(performance.now() - checked) },
    ssr: {
      path: pathname,
      language: 'en',
      state,
      data: pageData,
      queries,
      router: { loaderData: context.loaderData, actionData: context.actionData, errors: context.errors },
    },
  }
}
