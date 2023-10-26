import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

export default function useRoles(roles) {
  const user = useSelector(state => state.session.user)
  const [hasRoles, setHasRoles] = useState(false)

  if (!Array.isArray(roles)) {
    roles = [roles]
  }

  useEffect(() => {
    async function getUserRoles() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        if (idTokenResult.claims.roles && idTokenResult.claims.roles.some(role => roles.includes(role))) {
          setHasRoles(true)
        }
      }
    }

    getUserRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return hasRoles
}