import { useSelector } from 'react-redux'

export default function useAnonymous() {
  const isAnonymous = useSelector((/** @type {RootState} */ state) => state.session.isAnonymous)

  return isAnonymous
}