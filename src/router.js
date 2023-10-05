import { Navigate, createBrowserRouter } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Signup from '@/routes/Signup'
import Login from '@/routes/Login'
import Logout from '@/routes/Logout'
import Map from '@/routes/Map'
import Loading from '@/routes/Loading'
import Account from '@/routes/Account'
import AboutRoute from 'routes/About'
import NoMatch from '@/routes/NoMatch'
import Layout from '@/components/App/Layout'
import SignupWithEmail from '@/components/auth/SignupWithEmail'
import ResultPane, { resultPaneLoader } from '@/components/ResultPane/ResultPane'
import MediaPane, { mediaPaneLoader } from '@/routes/MediaPane/MediaPane'
import LoginWithEmailPrompt from '@/components/auth/LoginWithEmailPrompt'
import AppRoot from '@/components/App/AppRoot'
import CaveAsset from '@/models/CaveAsset'
import { coverImageLoader } from '@/components/ResultPane/CoverImage'

function SkipIfLoggedin({ children }) {
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const continueUrl = useSelector(state => state.session.continueUrl)

  if (isLoggedIn) {
    const navigateToUrl = continueUrl ? `${continueUrl}` : '/'
    return <Navigate to={navigateToUrl} />
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
                <Login />
              </SkipIfLoggedin>
            ),
            children: [
              {
                path: 'with-email',
                element: <LoginWithEmailPrompt open={true} />
              }
            ]
          },
          {
            path: 'logout',
            element: <Logout />
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
        element: <Map />,
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