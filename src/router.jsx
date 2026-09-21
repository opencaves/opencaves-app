import { useEffect, useRef } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Signup from '@/routes/Signup.jsx'
import LogIn from '@/routes/LogIn.jsx'
import Map from '@/routes/Map.jsx'
import Loading from '@/routes/Loading.jsx'
import Account from '@/routes/Account.jsx'
import AboutRoute from '@/routes/About.jsx'
import NoMatch from '@/routes/NoMatch.jsx'
import AdminHome from '@/routes/admin/AdminHome.jsx'
import AdminCaves from '@/routes/admin/AdminCaves.jsx'
import AdminCaveEdit from '@/routes/admin/AdminCaveEdit.jsx'
import AdminSistemas from '@/routes/admin/AdminSistemas.jsx'
import AdminSistemaEdit from '@/routes/admin/AdminSistemaEdit.jsx'
import AdminReferenceData from '@/routes/admin/AdminReferenceData.jsx'
import Layout from '@/components/App/Layout.jsx'
import AppRoot from '@/components/App/AppRoot.jsx'
import ResultPane, { resultPaneLoader } from '@/components/ResultPane/ResultPane.jsx'
import MediaPane, { mediaPaneLoader } from '@/components/MediaPane/MediaPane.jsx'
import SignupWithEmail from '@/components/auth/SignupWithEmail.jsx'
import LogInWithEmailPrompt from '@/components/auth/LogInWithEmailPrompt.jsx'
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
            element: (
              <SkipIfLoggedin>
                <Signup />
              </SkipIfLoggedin>
            ),
            children: [
              {
                path: 'with-email',
                element: <SignupWithEmail open={true} />
              }
            ]
          },
          {
            path: 'login',
            element: (
              <SkipIfLoggedin>
                <LogIn />
              </SkipIfLoggedin>
            ),
            children: [
              {
                path: 'with-email',
                element: <LogInWithEmailPrompt open={true} />
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
            element: (
              <RequireEditor>
                <AdminHome />
              </RequireEditor>
            )
          },
          {
            path: 'admin/caves',
            element: (
              <RequireEditor>
                <AdminCaves />
              </RequireEditor>
            )
          },
          {
            path: 'admin/caves/:caveId',
            element: (
              <RequireEditor>
                <AdminCaveEdit />
              </RequireEditor>
            )
          },
          {
            path: 'admin/sistemas',
            element: (
              <RequireEditor>
                <AdminSistemas />
              </RequireEditor>
            )
          },
          {
            path: 'admin/sistemas/:sistemaId',
            element: (
              <RequireEditor>
                <AdminSistemaEdit />
              </RequireEditor>
            )
          },
          {
            path: 'admin/reference/:collectionName',
            element: (
              <RequireEditor>
                <AdminReferenceData />
              </RequireEditor>
            )
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
                element: <MediaPane />,
                loader: mediaPaneLoader
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