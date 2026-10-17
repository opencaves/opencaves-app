// The way this device last signed in, for the log-in page's "Last used"
// chip: a per-device convenience, kept in the browser only (no account is
// known before signing in).
const STORAGE_KEY = 'oc-last-sign-in-method'

// The methods the log-in page offers: a provider's id, or email (a password
// or an emailed link).
const METHODS = ['google.com', 'microsoft.com', 'email']

/**
 * Remembers how this device just signed in (or up).
 *
 * @param {string} method - A provider's id ('google.com', 'microsoft.com'), or 'email'.
 */
export function rememberSignInMethod(method) {
  if (!METHODS.includes(method)) return
  try {
    localStorage.setItem(STORAGE_KEY, method)
  } catch {
    // No storage (a private window...): no chip next time.
  }
}

/**
 * How this device last signed in, or null: never, or no storage.
 *
 * @returns {string|null}
 */
export function lastSignInMethod() {
  try {
    const method = localStorage.getItem(STORAGE_KEY)
    return METHODS.includes(method) ? method : null
  } catch {
    return null
  }
}
