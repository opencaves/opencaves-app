import { useEffect, useRef } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Loading from '@/routes/Loading.jsx'
import Account from '@/routes/Account.jsx'
import AboutRoute from '@/routes/About.jsx'
import NoMatch from '@/routes/NoMatch.jsx'
import Layout from '@/components/App/Layout.jsx'
import AppRoot from '@/components/App/AppRoot.jsx'
import { loadMap, loadResultPane } from '@/routes/mapRoute.js'
import { deleteContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'

function SkipIfLoggedin({ children }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const continueUrl = useSelector((state) => state.session.continueUrl)
  const dispatch = useDispatch()

  // Snapshot continueUrl so that deleteContinueUrl() (dispatched below once
  // logged in) doesn't wipe out the redirect target before it's used: that
  // would cause a second render with continueUrl already null, redirecting
  // to '/' instead of the page the user was on.
  const continueUrlRef = useRef(continueUrl)
  if (continueUrl) {
    continueUrlRef.current = continueUrl
  }

  useEffect(() => {
    if (isLoggedIn) {
      dispatch(deleteContinueUrl())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  return isLoggedIn ? <Navigate to={continueUrlRef.current ?? '/'} /> : children
}

function RequireAuth({ children }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const authResolved = useSelector((state) => state.session.authResolved)

  if (!authResolved) {
    return null
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" />
  }

  return children
}

// visitorsTo: where anyone else goes instead (a public page at that
// address's level) - by default sign-in, or home once signed in.
function RequireEditor({ children, visitorsTo }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const authResolved = useSelector((state) => state.session.authResolved)

  if (!authResolved) {
    return null
  }

  if (visitorsTo && !(isLoggedIn && roles.includes('editor'))) {
    return <Navigate to={visitorsTo} replace />
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" />
  }

  if (!roles.includes('editor')) {
    return <Navigate to="/" />
  }

  return children
}

function RequireAdmin({ children }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)
  const authResolved = useSelector((state) => state.session.authResolved)

  if (!authResolved) {
    return null
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" />
  }

  if (!roles.includes('admin')) {
    return <Navigate to="/" />
  }

  return children
}

// Code-splitting helpers for react-router's data-router `lazy` route
// property: each of these keeps a heavy/rarely-visited page (the whole
// admin section, the 360°-photo viewer, auth pages) out of the initial
// bundle, only fetching it once that route is actually navigated to.
function skipIfLoggedIn(importer) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return {
        Component: () => (
          <SkipIfLoggedin>
            <Component />
          </SkipIfLoggedin>
        ),
      }
    },
  }
}

function requireAuth(importer) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return {
        Component: () => (
          <RequireAuth>
            <Component />
          </RequireAuth>
        ),
      }
    },
  }
}

function requireEditor(importer, visitorsTo) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return {
        Component: () => (
          <RequireEditor visitorsTo={visitorsTo}>
            <Component />
          </RequireEditor>
        ),
      }
    },
  }
}

function requireAdmin(importer) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return {
        Component: () => (
          <RequireAdmin>
            <Component />
          </RequireAdmin>
        ),
      }
    },
  }
}

// /areas/<slug>: the area's section of the cave list (/caves#<slug>) - an area
// has no page of its own.
function AreaRedirect() {
  const { areaSlug } = useParams()
  return <Navigate to={`/caves#${areaSlug}`} replace />
}

function RedirectToCollection() {
  const { collectionName } = useParams()
  return <Navigate to={`/${collectionName}`} replace />
}

function RedirectToCollectionEdit() {
  const { collectionName, itemId } = useParams()
  return <Navigate to={`/${collectionName}/${itemId}/edit`} replace />
}

// The app's routes, for the browser's router (router.jsx) and the server's
// rendering of the public pages (entry-server.jsx).
export const routes = [
  {
    path: '/',
    element: <AppRoot />,
    HydrateFallback: Loading,
    // Catches any path that doesn't match a route anywhere under here
    // (not just this route's own render errors) - without it, a totally
    // unmatched path (e.g. an old bookmarked URL) falls through to
    // react-router's own bare, unstyled default error page instead of the
    // app's NoMatch component.
    errorElement: <NoMatch />,
    children: [
      // Development only: the error pages, to look at (/dev/error/map: the
      // map failing; /dev/error/page: a page failing to load;
      // /dev/error/offline: one failing offline - shown as offline without
      // cutting the network), and the snackbars (/dev/snackbars).
      ...(import.meta.env.DEV
        ? [
            {
              path: 'dev/snackbars',
              lazy: () => import('@/routes/dev/SnackbarPreview.jsx').then(({ default: Component }) => ({ Component })),
            },
            {
              path: 'dev/error/map',
              lazy: () => import('@/components/Map/MapState.jsx').then(({ MapError }) => ({ Component: () => <MapError error={new Error('Preview of the map error page')} /> })),
            },
            {
              path: 'dev/error/offline',
              loader: () => {
                throw Object.assign(new Error('Preview of a page failing to load offline'), { offlinePreview: true })
              },
              element: null,
              errorElement: <NoMatch />,
            },
            {
              path: 'dev/error/page',
              loader: () => {
                throw new Error('Preview of a page failing to load')
              },
              element: null,
              errorElement: <NoMatch />,
            },
          ]
        : []),
      {
        element: <Layout />,
        children: [
          {
            // A page failing inside the layout: the app bar and its search
            // stay (the root's NoMatch replaced them).
            errorElement: <NoMatch inLayout />,
            children: [
              {
                // The landing page (its content to be settled).
                index: true,
                lazy: () => import('@/routes/Home.jsx').then(({ default: Component }) => ({ Component })),
              },
              {
                path: 'about',
                element: <AboutRoute />,
              },
              {
                path: 'privacy',
                lazy: () => import('@/routes/LegalPage.jsx').then(({ default: LegalPage }) => ({ Component: () => <LegalPage page="privacy" /> })),
              },
              {
                // What OpenCaves' users can do (exploring, contributing).
                path: 'what-can-i-do',
                lazy: () => import('@/routes/WhatCanIDo.jsx').then(({ default: Component }) => ({ Component })),
              },
              {
                path: 'terms',
                lazy: () => import('@/routes/LegalPage.jsx').then(({ default: LegalPage }) => ({ Component: () => <LegalPage page="terms" /> })),
              },
              {
                path: 'signup',
                ...skipIfLoggedIn(() => import('@/routes/Signup.jsx')),
                children: [
                  {
                    path: 'with-email',
                    lazy: () => import('@/components/auth/SignupWithEmail.jsx').then(({ default: Component }) => ({ Component: () => <Component open={true} /> })),
                  },
                ],
              },
              {
                path: 'login',
                ...skipIfLoggedIn(() => import('@/routes/LogIn.jsx')),
                children: [
                  {
                    path: 'with-email',
                    lazy: () => import('@/components/auth/LogInWithEmailPrompt.jsx').then(({ default: Component }) => ({ Component: () => <Component open={true} /> })),
                  },
                ],
              },
              {
                path: 'account',
                element: (
                  <RequireAuth>
                    <Account />
                  </RequireAuth>
                ),
              },
              {
                path: 'loading',
                element: <Loading />,
              },
              {
                path: 'dashboard',
                ...requireAuth(() => import('@/routes/dashboard/AdminDashboard.jsx')),
              },
              {
                path: 'dashboard/:collectionName',
                element: <RedirectToCollection />,
              },
              {
                path: 'dashboard/:collectionName/:itemId/edit',
                element: <RedirectToCollectionEdit />,
              },
              // The public index pages (crawlable; the server renders them too:
              // functions/js/seo). Editors edit each at its address + /edit.
              {
                path: 'caves',
                lazy: () => import('@/routes/caves/CaveIndex.jsx').then(({ default: Component }) => ({ Component })),
              },
              {
                // A cave's own page (its place on the map is /map/<id>).
                path: 'caves/:caveId',
                lazy: () => import('@/routes/caves/CavePage.jsx').then(({ default: Component }) => ({ Component })),
                // Its galleries, over the page: its photos, its system's maps.
                children: [
                  {
                    // The system's maps, over the page (MapGallery); /edit: a map's Edit dialog.
                    path: 'maps/:mapId',
                    lazy: () => import('@/routes/gallery/MapGallery.jsx').then(({ default: Component }) => ({ Component })),
                    children: [{ path: 'edit', ...requireEditor(() => import('@/routes/map/maps/MapEdit.jsx')) }],
                  },
                  {
                    path: 'photos/:mediaId',
                    lazy: () => import('@/routes/gallery/PhotoGallery.jsx').then(({ default: Component }) => ({ Component })),
                  },
                ],
              },
              {
                path: 'sistemas',
                lazy: () => import('@/routes/sistemas/SistemaIndex.jsx').then(({ default: Component }) => ({ Component })),
              },
              {
                path: 'sistemas/:sistemaId',
                lazy: () => import('@/routes/sistemas/SistemaPage.jsx').then(({ default: Component }) => ({ Component })),
                children: [
                  {
                    // The system's maps, over the page (MapGallery); /edit: a map's Edit dialog.
                    path: 'maps/:mapId',
                    lazy: () => import('@/routes/gallery/MapGallery.jsx').then(({ default: Component }) => ({ Component })),
                    children: [{ path: 'edit', ...requireEditor(() => import('@/routes/map/maps/MapEdit.jsx')) }],
                  },
                ],
              },
              {
                // The latest caves, systems, connections and maps added in the app.
                path: 'whats-new',
                lazy: () => import('@/routes/WhatsNew.jsx').then(({ default: Component }) => ({ Component })),
              },
              {
                // An area has no page of its own any more: an old address goes to
                // its section of the cave list (the server redirects it too, firebase.json).
                path: 'areas/:areaSlug',
                Component: AreaRedirect,
              },
              ...Object.keys(REFERENCE_DATA_CONFIGS).flatMap((collectionName) => [
                {
                  // /areas has no public page: visitors go to the caves by area.
                  path: collectionName,
                  // Colours and languages: admins only (adminOnly).
                  ...(REFERENCE_DATA_CONFIGS[collectionName].adminOnly
                    ? requireAdmin(() => import('@/routes/dashboard/ReferenceDataEditor.jsx'))
                    : requireEditor(() => import('@/routes/dashboard/ReferenceDataEditor.jsx'), collectionName === 'areas' ? '/caves' : undefined)),
                },
                {
                  // :itemId: an area's slug or id (ReferenceDataItemEdit). Admins
                  // only for the lists editors only read (adminEdit).
                  path: `${collectionName}/:itemId/edit`,
                  ...(REFERENCE_DATA_CONFIGS[collectionName].adminOnly || REFERENCE_DATA_CONFIGS[collectionName].adminEdit ? requireAdmin : requireEditor)(() => import('@/routes/dashboard/ReferenceDataItemEdit.jsx')),
                },
              ]),
              {
                path: 'caves/edit',
                ...requireEditor(() => import('@/routes/caves/CaveList.jsx')),
              },
              {
                path: 'caves/:caveId/edit',
                ...requireEditor(() => import('@/routes/caves/CaveEdit.jsx')),
                // Its galleries, over the form: its photos, its system's maps.
                children: [
                  {
                    path: 'photos/:mediaId',
                    lazy: () => import('@/routes/gallery/PhotoGallery.jsx').then(({ default: Component }) => ({ Component })),
                  },
                  {
                    path: 'maps/:mapId',
                    lazy: () => import('@/routes/gallery/MapGallery.jsx').then(({ default: Component }) => ({ Component })),
                    children: [{ path: 'edit', ...requireEditor(() => import('@/routes/map/maps/MapEdit.jsx')) }],
                  },
                ],
              },
              {
                path: 'sistemas/edit',
                ...requireEditor(() => import('@/routes/sistemas/SistemaList.jsx')),
              },
              {
                // :sistemaId: the system's slug, or its id (older links).
                path: 'sistemas/:sistemaId/edit',
                ...requireEditor(() => import('@/routes/sistemas/SistemaEdit.jsx')),
              },
              {
                path: 'connections',
                ...requireEditor(() => import('@/routes/connections/ConnectionList.jsx')),
              },
              {
                path: 'connections/:connectionId/edit',
                ...requireEditor(() => import('@/routes/connections/ConnectionEdit.jsx')),
              },
              {
                path: 'users',
                ...requireAdmin(() => import('@/routes/dashboard/UsersAdmin.jsx')),
              },
              {
                // With a map's id: its original next to its drawing, over the
                // list (one route, so the list keeps its search and scroll).
                path: 'map-layers/:mapId?',
                ...requireAdmin(() => import('@/routes/map-layers/MapLayersAdmin.jsx')),
              },
              {
                // Who changed what (undoable), and the photos and maps in the
                // trash: ?tab=trash.
                path: 'audits',
                ...requireAdmin(() => import('@/routes/audits/Audits.jsx')),
              },
              {
                // The beta testers' reports (Send feedback), listed like
                // GitHub's issues (?state, q, kind, stage, sort)... Every
                // registered account reads them (Ideas and fixes: what's
                // coming), admins manage them; anonymous visitors are sent
                // to log in, as for /account.
                path: 'feedback',
                ...requireAuth(() => import('@/routes/feedback/FeedbackList.jsx')),
              },
              {
                // ...and each one on its own page, its thread and replies.
                path: 'feedback/:feedbackId',
                ...requireAuth(() => import('@/routes/feedback/FeedbackReport.jsx')),
              },
              {
                // Any other address: not found, the app bar kept.
                path: '*',
                element: <NoMatch inLayout />,
              },
            ],
          },
        ],
      },
      {
        path: '/map',
        id: 'map',
        // On demand: Mapbox stays out of the other pages (mapRoute.js).
        lazy: () => loadMap().then(({ default: Component }) => ({ Component })),
        errorElement: <NoMatch />,
        children: [
          {
            path: ':caveId',
            id: 'result-pane',
            // No loader: the pane reads its data from the store and the
            // offline cache, so it must open without a network round trip.
            lazy: () => loadResultPane().then(({ default: Component }) => ({ Component })),
            children: [
              {
                // ResultPane owns edit mode; this empty leaf makes the URL
                // match without rendering another pane or warning about a
                // missing route element.
                path: 'edit',
                element: <></>,
              },
              {
                path: 'medias/:mediaId?',
                lazy: () => import('@/components/MediaPane/MediaPane.jsx').then(({ default: Component, mediaPaneLoader: loader }) => ({ Component, loader })),
              },
              {
                path: 'maps/:mapId?',
                lazy: () => import('@/components/MapPane/MapPane.jsx').then(({ default: Component, mapPaneLoader: loader }) => ({ Component, loader })),
                children: [
                  {
                    // The map's Edit dialog, over its viewer.
                    path: 'edit',
                    ...requireEditor(() => import('@/routes/map/maps/MapEdit.jsx')),
                  },
                ],
              },
              {
                path: 'sistemas',
                ...requireEditor(() => import('@/components/SistemaPane/SistemaPane.jsx')),
                children: [
                  {
                    path: ':sistemaId/edit',
                    ...requireEditor(() => import('@/components/SistemaPane/SistemaEditPane.jsx')),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]
