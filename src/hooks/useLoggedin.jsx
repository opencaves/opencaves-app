import { useSelector } from 'react-redux'

export default function useLoggedIn() {
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)

  return isLoggedIn
}