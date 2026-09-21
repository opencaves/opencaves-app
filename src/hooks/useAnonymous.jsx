import { useSelector } from 'react-redux'

export default function useAnonymous() {
  const isAnonymous = useSelector(state => state.session.isAnonymous)

  return isAnonymous
}