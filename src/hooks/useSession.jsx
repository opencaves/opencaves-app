import useLoggedIn from './useLoggedin'
import useAnonymous from './useAnonymous'

/**
 * Whether there's a session: anonymous or logged in.
 *
 * @returns {boolean}
 */
export default function useSession() {
  const isAnonymous = useAnonymous()
  const isLoggedIn = useLoggedIn()

  return isAnonymous || isLoggedIn
}