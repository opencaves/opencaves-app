import { getAuth } from 'firebase/auth'
import { useEffect, useState } from 'react'

export default function useRoles(roles) {
  const auth = getAuth()
  const user = auth.currentUser
  const [hasRoles, setHasRoles] = useState(false)

  if (!Array.isArray(roles)) {
    roles = [roles]
  }

  useEffect(() => {
    async function getUserRoles() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        const userRoles = idTokenResult.claims.roles
        console.log('roles: %o', roles)
        console.log('userRoles: %o', userRoles)
        var newHasRoles = !!userRoles && roles.every(role => userRoles.includes(role))

        setHasRoles(newHasRoles)
      }
    }

    getUserRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return hasRoles
}