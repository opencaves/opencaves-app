import useLoggedIn from './useLoggedin'
import useAnonymous from './useAnonymous'

export default function useSession() {
  const isAnonymous = useAnonymous()
  const isLoggedIn = useLoggedIn()

  return isAnonymous || isLoggedIn
}