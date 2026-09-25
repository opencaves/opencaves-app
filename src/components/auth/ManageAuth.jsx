import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { setUser, setUserRoles } from '@/redux/slices/sessionSlice.jsx'
import { auth, functions } from '@/config/firebase.js'

const ensureEditorRole = httpsCallable(functions, 'ensureEditorRole')

export default function ManageAuth() {
  const dispatch = useDispatch()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      let roles = []

      if (user) {
        try {
          let idTokenResult = await user.getIdTokenResult(true)
          roles = idTokenResult?.claims?.roles

          if (!Array.isArray(roles) || !roles.includes('editor')) {
            await ensureEditorRole()
            idTokenResult = await user.getIdTokenResult(true)
            roles = idTokenResult?.claims?.roles
          }
        } catch (error) {
          console.warn('[ManageAuth] Unable to refresh editor role:', error)
        }
      }

      dispatch(setUser(user ? user.toJSON() : user))
      dispatch(setUserRoles(Array.isArray(roles) ? roles : []))
    })

    return unsubscribe
  }, [dispatch])
}
