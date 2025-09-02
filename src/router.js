import { useEffect } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Signup from '@/routes/Signup'
import LogIn from '@/routes/LogIn'
import Map from '@/routes/Map'
import Loading from '@/routes/Loading'
import Account from '@/routes/Account'
import AboutRoute from 'routes/About'
import NoMatch from '@/routes/NoMatch'
import Layout from '@/components/App/Layout'
import AppRoot from '@/components/App/AppRoot'
import ResultPane, { resultPaneLoader } from '@/components/ResultPane/ResultPane'
import MediaPane, { mediaPaneLoader } from '@/components/MediaPane/MediaPane'
import SignupWithEmail from '@/components/auth/SignupWithEmail'
import LogInWithEmailPrompt from '@/components/auth/LogInWithEmailPrompt'
import { deleteContinueUrl } from '@/redux/slices/sessionSlice'

function SkipIfLoggedin({ children }) {
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const continueUrl = useSelector(state => state.session.continueUrl)
  const dispatch = useDispatch()
  const navigateToUrl = continueUrl ? `${continueUrl}` : '/'

  useEffect(() => {
    if (isLoggedIn) {
      dispatch(deleteContinueUrl())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])


  return isLoggedIn ? (
    <Navigate to={navigateToUrl} />
  ) : children
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