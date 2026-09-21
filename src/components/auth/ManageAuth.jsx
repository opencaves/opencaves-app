import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { setUser } from '@/redux/slices/sessionSlice.jsx'
import { auth, functions } from '@/config/firebase.js'

const ensureEditorRole = httpsCallable(functions, 'ensureEditorRole')

export default function ManageAuth() {
  const dispatch = useDispatch()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult(true)
          const roles = idTokenResult?.claims?.roles

          if (!Array.isArray(roles) || !roles.includes('editor')) {
            await ensureEditorRole()
            await user.getIdTokenResult(true)
          }
        } catch (error) {
          console.warn('[ManageAuth] Unable to refresh editor role:', error)
        }
      }

      dispatch(setUser(user ? user.toJSON() : user))
    })

    return unsubscribe
  }, [dispatch])
}
