import { useEffect, useRef } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
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

function SkipIfLoggedin({ children }) {
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const continueUrl = useSelector(state => state.session.continueUrl)
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


  return isLoggedIn ? (
    <Navigate to={continueUrlRef.current ?? '/'} />
  ) : children
}

function RequireEditor({ children }) {
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const roles = useSelector(state => state.session.roles)

  if (!isLoggedIn) {
    return <Navigate to='/login' />
  }

  if (!roles.includes('editor')) {
    return <Navigate to='/' />
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
      return { Component: () => <SkipIfLoggedin><Component /></SkipIfLoggedin> }
    }
  }
}

function requireEditor(importer) {
  return {
    lazy: async () => {
      const { default: Component } = await importer()
      return { Component: () => <RequireEditor><Component /></RequireEditor> }
    }
  }
}

const routes = [
  {
    path: '/',
    element: <AppRoot />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            index: true,
            element: <Navigate to='map' />,
            errorElement: <NoMatch />
          },
          {
            path: 'about',
            element: <AboutRoute />
          },
          {
            path: 'signup',
            ...skipIfLoggedIn(() => import('@/routes/Signup.jsx')),
            children: [
              {
                path: 'with-email',
                lazy: () => import('@/components/auth/SignupWithEmail.jsx')
                  .then(({ default: Component }) => ({ Component: () => <Component open={true} /> }))
              }
            ]
          },
          {
            path: 'login',
            ...skipIfLoggedIn(() => import('@/routes/LogIn.jsx')),
            children: [
              {
                path: 'with-email',
                lazy: () => import('@/components/auth/LogInWithEmailPrompt.jsx')
                  .then(({ default: Component }) => ({ Component: () => <Component open={true} /> }))
              }
            ]
          },
          {
            path: 'account',
            element: <Account />
          },
          {
            path: 'loading',
            element: <Loading />
          },
          {
            path: 'admin',
            ...requireEditor(() => import('@/routes/admin/AdminHome.jsx'))
          },
          {
            path: 'admin/caves',
            ...requireEditor(() => import('@/routes/admin/AdminCaves.jsx'))
          },
          {
            path: 'admin/caves/:caveId',
            ...requireEditor(() => import('@/routes/admin/AdminCaveEdit.jsx'))
          },
          {
            path: 'admin/sistemas',
            ...requireEditor(() => import('@/routes/admin/AdminSistemas.jsx'))
          },
          {
            path: 'admin/sistemas/:sistemaId',
            ...requireEditor(() => import('@/routes/admin/AdminSistemaEdit.jsx'))
          },
          {
            path: 'admin/reference/:collectionName',
            ...requireEditor(() => import('@/routes/admin/AdminReferenceData.jsx'))
          }
        ]
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
                path: 'medias/:mediaId?',
                lazy: () => import('@/components/MediaPane/MediaPane.jsx')
                  .then(({ default: Component, mediaPaneLoader: loader }) => ({ Component, loader }))
              }
            ]
          }
        ]
      }
    ]
  }
]

export default createBrowserRouter(routes, {
  future: {
    v7_normalizeFormMethod: true,
  },
})