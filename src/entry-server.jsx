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
import { buildPageState, pageOf } from './ssr/pageState.js'

// The server's rendering of the public pages - /, /caves, /caves/<id>,
// /sistemas, /sistemas/<id> - with the app's own components (built by `vite
// build --ssr`, run by functions/js/seo/ssr.js): the page's HTML, the
// Emotion styles it uses, and what the browser needs to render the same
// page again and take it over (index.jsx hydrates it): the store's data, the
// query results (ssrContext.js) and the router's state. In English (the
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

// url: the page's full address (its host decides the emulators' file
// addresses: localhost); raw, maps, assets: the data (pageState.js); title:
// the page's <title> (the server's, functions/js/seo), the app's own title
// (App's Helmet) until the page sets it.
// Returns { html, styles, status, ssr } or { notFound: true }.
export async function render({ url, raw, maps, assets, title }) {
  const { pathname, hostname } = new URL(url)
  const page = pageOf(pathname)
  if (!page) return { notFound: true }
  const { state, queries, found } = buildPageState(page, { raw, maps, assets })
  if (!found) return { notFound: true }
  if (title) state.app = { ...createServerStore().getState().app, title }

  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en')
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request(url))
  if (context instanceof Response) return { notFound: true }
  const router = createStaticRouter(handler.dataRoutes, context)
  const store = createServerStore(state)
  // The browser's Emotion cache has the same key (MUI's default, "css"):
  // it takes these styles over instead of inserting them again.
  const cache = createCache({ key: 'css' })
  const emotionServer = createEmotionServer(cache)

  // One page at a time: rendering is synchronous, the context set around it.
  setServerContext({ hostname, queries })
  let html
  try {
    html = renderToString(
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
    )
  } finally {
    setServerContext(null)
  }
  // React puts the <title> it renders (App's Helmet) first: the page's
  // <head> has it already (functions/js/seo/shared.js), and the browser's
  // React adds its own to <head> - not one in the page's body as well.
  html = html.replace(/^<title>[^<]*<\/title>/, '')
  const styles = emotionServer.constructStyleTagsFromChunks(emotionServer.extractCriticalToChunks(html))
  return {
    html,
    styles,
    status: context.statusCode,
    ssr: {
      path: pathname,
      language: 'en',
      state,
      queries,
      router: { loaderData: context.loaderData, actionData: context.actionData, errors: context.errors },
    },
  }
}
