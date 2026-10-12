import { OAuthProvider, linkWithCredential } from 'firebase/auth'
import { clearPendingLink, PENDING_LINK_EVENT, PENDING_LINK_KEY, readPendingLink } from './pendingLink.js'

// The pending link's part that needs the Firebase SDK (pendingLink.js).

/**
 * From the auth/account-exists-with-different-credential error.
 *
 * @param {import('firebase/app').FirebaseError} error
 * @returns {boolean} True when kept.
 */
export function savePendingLink(error) {
  const credential = OAuthProvider.credentialFromError(error)
  const email = error?.customData?.email
  if (!credential || !email) return false
  try {
    sessionStorage.setItem(PENDING_LINK_KEY, JSON.stringify({ email, providerId: credential.providerId, credential: credential.toJSON() }))
  } catch {
    return false
  }
  window.dispatchEvent(new CustomEvent(PENDING_LINK_EVENT, { detail: { email, providerId: credential.providerId } }))
  return true
}

/**
 * Links the kept credential to the signed-in user, when it's the same email.
 *
 * @param {import('firebase/auth').User} user
 * @returns {Promise<string|null>} The linked provider's id, or null when there was nothing to link.
 */
export async function linkPendingCredential(user) {
  const pending = readPendingLink()
  if (!pending || !user?.email || user.email.toLowerCase() !== pending.email.toLowerCase()) return null
  try {
    await linkWithCredential(user, OAuthProvider.credentialFromJSON(pending.credential))
    return pending.providerId
  } catch (error) {
    // Already linked (another tab did it): nothing to do.
    if (error.code === 'auth/provider-already-linked' || error.code === 'auth/credential-already-in-use') return null
    throw error
  } finally {
    clearPendingLink()
  }
}
