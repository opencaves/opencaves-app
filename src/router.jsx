import { useEffect } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Signup from '@/routes/Signup.jsx'
import LogIn from '@/routes/LogIn.jsx'
import Map from '@/routes/Map.jsx'
import Loading from '@/routes/Loading.jsx'
import Account from '@/routes/Account.jsx'
import AboutRoute from '@/routes/About.jsx'
import NoMatch from '@/routes/NoMatch.jsx'
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