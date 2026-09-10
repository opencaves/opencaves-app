import { useSelector } from 'react-redux'

export default function useLoggedIn() {
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)

  return isLoggedIn
}