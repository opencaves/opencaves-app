import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { onIdTokenChanged, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { setUser, setUserRoles } from '@/redux/slices/sessionSlice.jsx'
import { auth, functions } from '@/config/firebase.js'

const ensureEditorRole = httpsCallable(functions, 'ensureEditorRole')

export default function ManageAuth() {
  const dispatch = useDispatch()

  useEffect(() => {
    // uids we already asked ensureEditorRole for, so a call that doesn't grant
    // the role can't retrigger itself through the forced refresh below.
    const editorRoleRequested = new Set()

    // Runs as the onIdTokenChanged listener, so it must never force a token
    // refresh unconditionally: a forced refresh fires onIdTokenChanged again,
    // which would loop forever and re-render the app nonstop.
    async function syncUser(user) {
      let roles = []

      if (user) {
        try {
          let idTokenResult = await user.getIdTokenResult()
          roles = idTokenResult?.claims?.roles

          if ((!Array.isArray(roles) || !roles.includes('editor')) && !user.isAnonymous && !editorRoleRequested.has(user.uid)) {
            editorRoleRequested.add(user.uid)
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
    }

    async function refreshCurrentUser() {
      const user = auth.currentUser
      if (!user) return

      try {
        await user.reload()
        // Picks up role changes made server-side; the resulting
        // onIdTokenChanged event runs syncUser.
        await user.getIdToken(true)
      } catch (error) {
        if (error.code === 'auth/user-disabled' || error.code === 'auth/user-not-found') {
          await signOut(auth)
          return
        }
        console.warn('[ManageAuth] Unable to reload user:', error)
      }
    }

    const unsubscribe = onIdTokenChanged(auth, syncUser)
    const refreshInterval = setInterval(refreshCurrentUser, 30000)

    return () => {
      unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [dispatch])
}
