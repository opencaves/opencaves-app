import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

// For an action only accounts can take (adding a photo or a map): to sign up
// (an anonymous visitor) or log in, coming back here afterwards.
export function useRequireLogin() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isAnonymous = useSelector((state) => state.session.isAnonymous)
  return useCallback(() => {
    dispatch(setContinueUrl(buildContinueUrl(location)))
    navigate(isAnonymous ? '/signup' : '/login')
  }, [dispatch, location, navigate, isAnonymous])
}
