import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { useColorScheme } from '@mui/material/styles'
import { onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth'
import { setUser, setUserRoles } from '@/redux/slices/sessionSlice.jsx'
import { auth, callable } from '@/config/firebase.js'
import i18n from '@/i18n.js'
import { toServiceLanguage } from '@/utils/lang.js'
import { applyLanguage, loadAccountLanguage } from '@/services/languagePreference.js'
import { loadAccountUnits } from '@/services/unitsPreference.js'
import { loadAccountColorMode } from '@/services/colorModePreference.js'
import { setUnits } from '@/redux/slices/preferencesSlice.jsx'

const ensureEditorRole = callable('ensureEditorRole')
const sendWelcomeEmail = callable('sendWelcomeEmail')

// The welcome email (sendWelcomeEmail), asked for once per account on this
// device once it's an editor; the server sends it only once, to new accounts.
const WELCOMED_KEY = 'oc-welcome-email-asked'
function askWelcomeEmail(uid) {
  try {
    if (localStorage.getItem(WELCOMED_KEY)?.split(',').includes(uid)) return
  } catch {
    return
  }
  sendWelcomeEmail({ language: toServiceLanguage(i18n.language) })
    .then(({ data }) => {
      if (data?.retry) return
      try {
        localStorage.setItem(WELCOMED_KEY, [localStorage.getItem(WELCOMED_KEY), uid].filter(Boolean).join(','))
      } catch {
        // Not kept: asked again next time, sent once all the same.
      }
    })
    .catch((error) => console.warn('[ManageAuth] welcome email', error))
}

// The account's roles as last read from its token, kept on the device: an
// app started offline with an expired token (over an hour old) can't read
// them - refreshing it needs the network - and showed an editor the app as a
// visitor until back online. Only the interface follows them: the database's
// rules check the real token, so a changed copy here grants nothing.
const KNOWN_ROLES_KEY = 'oc-known-roles'

function rememberRoles(uid, roles) {
  try {
    if (uid) localStorage.setItem(KNOWN_ROLES_KEY, JSON.stringify({ uid, roles }))
    else localStorage.removeItem(KNOWN_ROLES_KEY)
  } catch {
    // Not kept: offline, the roles just aren't known.
  }
}

function knownRoles(uid) {
  try {
    const known = JSON.parse(localStorage.getItem(KNOWN_ROLES_KEY) || 'null')
    return known?.uid === uid && Array.isArray(known.roles) ? known.roles : []
  } catch {
    return []
  }
}

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
        let fromToken = false
        try {
          let idTokenResult = await user.getIdTokenResult()
          roles = idTokenResult?.claims?.roles

          if ((!Array.isArray(roles) || !roles.includes('editor')) && !user.isAnonymous && !editorRoleRequested.has(user.uid)) {
            editorRoleRequested.add(user.uid)
            await ensureEditorRole()
            idTokenResult = await user.getIdTokenResult(true)
            roles = idTokenResult?.claims?.roles
          }
          fromToken = true
        } catch (error) {
          // Offline (no token, or no ensureEditorRole): the last ones known.
          console.warn('[ManageAuth] Unable to refresh editor role:', error)
          if (!Array.isArray(roles) || roles.length === 0) roles = knownRoles(user.uid)
        }
        if (fromToken && !user.isAnonymous) rememberRoles(user.uid, Array.isArray(roles) ? roles : [])
        if (fromToken && !user.isAnonymous && Array.isArray(roles) && roles.includes('editor')) askWelcomeEmail(user.uid)
      } else {
        // Signed out: forgotten.
        rememberRoles(null)
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
