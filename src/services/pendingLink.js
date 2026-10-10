import { OAuthProvider, linkWithCredential } from 'firebase/auth'

// A provider sign-in refused because its email already has an account signed
// in another way (Firebase keeps one account per email): its credential kept
// for the session, then linked to that account once the person signs in to it
// (AccountLinking) - after which either way signs them in.
const KEY = 'oc-pending-link'
export const PENDING_LINK_EVENT = 'oc:pending-link'

/**
 * From the auth/account-exists-with-different-credential error.
 *
 * @param {Error} error
 * @returns {boolean} True when kept.
 */
export function savePendingLink(error) {
  const credential = OAuthProvider.credentialFromError(error)
  const email = error?.customData?.email
  if (!credential || !email) return false
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ email, providerId: credential.providerId, credential: credential.toJSON() }))
  } catch {
    return false
  }
  window.dispatchEvent(new CustomEvent(PENDING_LINK_EVENT, { detail: { email, providerId: credential.providerId } }))
  return true
}

export function readPendingLink() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function clearPendingLink() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing kept.
  }
}

/**
 * Links the kept credential to the signed-in user, when it's the same email.
 *
 * @param {User} user
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
