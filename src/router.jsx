import { createBrowserRouter, matchRoutes } from 'react-router-dom'
import { routes } from './routeTree.jsx'
import { withPageTransitions } from '@/utils/pageTransitions.js'

let router = null

/**
 * The browser's router, made once. On a page the server rendered
 * (entry-server.jsx), with the server's router state (window.__OC_SSR__),
 * so its first render is the server's and hydrates it. Its navigations
 * animated (withPageTransitions).
 *
 * @returns {object}
 */
export function getRouter() {
  router ||= withPageTransitions(
    createBrowserRouter(routes, {
      future: {
        v7_normalizeFormMethod: true,
      },
      hydrationData: window.__OC_SSR__?.router,
    }),
  )
  return router
}

/**
 * Before hydrating a server-rendered page: the lazy routes of its address
 * loaded, as the server had them - otherwise the router's first render would
 * be its HydrateFallback (the loading screen), not the server's page.
 *
 * @returns {Promise<void>}
 */
export async function loadMatchedLazyRoutes() {
  const matches = matchRoutes(routes, window.location)?.filter((match) => match.route.lazy) || []
  await Promise.all(
    matches.map(async ({ route }) => {
      const routeModule = await route.lazy()
      Object.assign(route, { ...routeModule, lazy: undefined })
    }),
  )
}
