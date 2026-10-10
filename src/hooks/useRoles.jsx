import { getAuth } from 'firebase/auth'
import { useEffect, useState } from 'react'

/**
 * Whether the signed-in user has every one of these roles (custom claims).
 *
 * @param {string|string[]} roles
 * @returns {boolean}
 */
export default function useRoles(roles) {
  const auth = getAuth()
  const user = auth.currentUser
  const [hasRoles, setHasRoles] = useState(false)

  const roleList = Array.isArray(roles) ? roles : [roles]

  useEffect(() => {
    async function getUserRoles() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        const userRoles = /** @type {string[]|undefined} */ (idTokenResult.claims.roles)
        const newHasRoles = !!userRoles && roleList.every(role => userRoles.includes(role))

        setHasRoles(newHasRoles)
      }
    }

    getUserRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return hasRoles
}