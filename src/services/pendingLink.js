// A provider sign-in refused because its email already has an account signed
// in another way (Firebase keeps one account per email): its credential kept
// for the session, then linked to that account once the person signs in to it
// (AccountLinking) - after which either way signs them in. What needs the
// Firebase SDK (reading the refused credential, linking it) is in
// pendingLinkAuth.js, loaded with Firebase: this part is read by every page.
export const PENDING_LINK_KEY = 'oc-pending-link'
export const PENDING_LINK_EVENT = 'oc:pending-link'

/**
 * The kept link, { email, providerId, credential }, or null.
 *
 * @returns {{email: string, providerId: string, credential: object}|null}
 */
export function readPendingLink() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_LINK_KEY))
  } catch {
    return null
  }
}

/**
 * Forgets the kept link.
 */
export function clearPendingLink() {
  try {
    sessionStorage.removeItem(PENDING_LINK_KEY)
  } catch {
    // Nothing kept.
  }
}
