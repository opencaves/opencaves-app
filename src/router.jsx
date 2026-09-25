import { useEffect, useRef } from 'react'
import { Navigate, createBrowserRouter, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Map from '@/routes/Map.jsx'
import Loading from '@/routes/Loading.jsx'
import Account from '@/routes/Account.jsx'
import AboutRoute from '@/routes/About.jsx'
import NoMatch from '@/routes/NoMatch.jsx'
import Layout from '@/components/App/Layout.jsx'
import AppRoot from '@/components/App/AppRoot.jsx'
import ResultPane, { resultPaneLoader } from '@/components/ResultPane/ResultPane.jsx'
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

  if (!isLoggedIn) {
    return <Navigate to="/login" />
  }

  return children
}

function RequireEditor({ children }) {
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const roles = useSelector((state) => state.session.roles)

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

function requireEditor(importer) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return {
        Component: () => (
          <RequireEditor>
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

function RedirectToCollection() {
  const { collectionName } = useParams()
  return <Navigate to={`/${collectionName}`} replace />
}

function RedirectToCollectionEdit() {
  const { collectionName, itemId } = useParams()
  return <Navigate to={`/${collectionName}/${itemId}/edit`} replace />
}

const routes = [
  {
    path: '/',
    element: <AppRoot />,
    // Catches any path that doesn't match a route anywhere under here
    // (not just this route's own render errors) - without it, a totally
    // unmatched path (e.g. an old bookmarked URL) falls through to
    // react-router's own bare, unstyled default error page instead of the
    // app's NoMatch component.
    errorElement: <NoMatch />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            index: true,
            element: <Navigate to="map" />,
            errorElement: <NoMatch />,
          },
          {
            path: 'about',
            element: <AboutRoute />,
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
            element: <Account />,
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
          ...Object.keys(REFERENCE_DATA_CONFIGS).flatMap((collectionName) => [
            {
              path: collectionName,
              ...requireEditor(() => import('@/routes/dashboard/ReferenceDataEditor.jsx')),
            },
            {
              path: `${collectionName}/:itemId/edit`,
              ...requireEditor(() => import('@/routes/dashboard/ReferenceDataItemEdit.jsx')),
            },
          ]),
          {
            path: 'caves',
            ...requireEditor(() => import('@/routes/caves/CaveList.jsx')),
          },
          {
            path: 'caves/:caveId/edit',
            ...requireEditor(() => import('@/routes/caves/CaveEdit.jsx')),
          },
          {
            path: 'sistemas',
            ...requireEditor(() => import('@/routes/sistemas/SistemaList.jsx')),
          },
          {
            path: 'sistemas/:sistemaId/edit',
            ...requireEditor(() => import('@/routes/sistemas/SistemaEdit.jsx')),
          },
          {
            path: 'users',
            ...requireAdmin(() => import('@/routes/dashboard/UsersAdmin.jsx')),
          },
        ],
      },
      {
        path: '/map',
        id: 'map',
        element: <Map />,
        errorElement: <NoMatch />,
        children: [
          {
            path: ':caveId',
            id: 'result-pane',
            element: <ResultPane />,
            loader: resultPaneLoader,
            children: [
              {
                // No element of its own - just needs to exist so this path
                // matches instead of 404ing. ResultPane (rendered by the
                // parent :caveId route above) detects it via useLocation()
                // and swaps in its editable content, since edit mode is a
                // state of the existing pane, not a separate page.
                path: 'edit',
              },
              {
                path: 'medias/:mediaId?',
                lazy: () => import('@/components/MediaPane/MediaPane.jsx').then(({ default: Component, mediaPaneLoader: loader }) => ({ Component, loader })),
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

export default createBrowserRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
})
