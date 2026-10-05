import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { useColorScheme } from '@mui/material/styles'
import { onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { setUser, setUserRoles } from '@/redux/slices/sessionSlice.jsx'
import { auth, functions } from '@/config/firebase.js'
import { applyLanguage, loadAccountLanguage } from '@/services/languagePreference.js'
import { loadAccountUnits } from '@/services/unitsPreference.js'
import { loadAccountColorMode } from '@/services/colorModePreference.js'
import { setUnits } from '@/redux/slices/preferencesSlice.jsx'

const ensureEditorRole = httpsCallable(functions, 'ensureEditorRole')

export default function ManageAuth() {
  const dispatch = useDispatch()
  const { setMode } = useColorScheme()

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

      // Without its tokens: they change on every refresh (every 30s below), and
      // a new user object re-rendered everything that reads it - the cave's
      // cover picture flickered. Nothing in the app reads them from the store.
      const { stsTokenManager, ...userData } = user ? user.toJSON() : {}
      dispatch(setUser(user ? userData : user))
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

  // The account's own language (LanguageSection), applied on sign-in - once
  // per sign-in, not on every token refresh like onIdTokenChanged.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) return
      try {
        const language = await loadAccountLanguage(user.uid)
        if (language) applyLanguage(language)
      } catch (error) {
        console.warn('[ManageAuth] Unable to load the account language:', error)
      }
      // Its units too (UnitsSection).
      try {
        const units = await loadAccountUnits(user.uid)
        if (units) dispatch(setUnits(units))
      } catch (error) {
        console.warn('[ManageAuth] Unable to load the account units:', error)
      }
      // And its display mode (AppearanceSection).
      try {
        const colorMode = await loadAccountColorMode(user.uid)
        if (colorMode) setMode(colorMode)
      } catch (error) {
        console.warn('[ManageAuth] Unable to load the account display mode:', error)
      }
    })
  }, [dispatch, setMode])
}
