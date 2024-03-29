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
        const roles = idTokenResult.claims.roles
        var newHasRoles = !!roles && roles.some(role => roles.includes(role))

        if (newHasRoles !== hasRoles) {
          setHasRoles(newHasRoles)
        }
      }
    }

    getUserRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return hasRoles
}