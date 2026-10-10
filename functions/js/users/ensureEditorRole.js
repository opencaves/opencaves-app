import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { auth } from '../init.js'
import { ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { hasVerifiedEmail } from './verifiedEmail.js'

/**
 * The caller's editor role, given when it's missing (every verified account is
 * an editor): its roles, and whether it's frozen.
 *
 * @param {CallableRequest} request
 * @returns {Promise<{roles: string[], frozen?: boolean}>}
 * @throws {HttpsError} unauthenticated when not signed in; permission-denied
 *   for an anonymous session ("Sign up to edit.") or an unverified email.
 */
export const ensureEditorRole = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async request => {
  const uid = request.auth?.uid

  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to ensure editor permissions.')
  }

  // Anonymous sessions (every visitor) don't edit: they keep their
  // preferences, and get the role once they sign up (the account is linked,
  // same uid).
  if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Sign up to edit.')
  }

  const currentUser = await auth.getUser(uid)
  const currentRoles = Array.isArray(currentUser.customClaims?.roles)
    ? currentUser.customClaims.roles
    : []

  // Frozen by an admin (manageUsers' setUserFrozen): no editing until unfrozen.
  if (currentUser.customClaims?.frozen) {
    return { roles: currentRoles, frozen: true }
  }

  if (currentRoles.includes('editor')) {
    return { roles: currentRoles }
  }

  if (!hasVerifiedEmail(currentUser)) {
    throw new HttpsError('permission-denied', 'Verify your email to edit.')
  }

  const nextRoles = [...new Set([...currentRoles, 'editor'])]
  await auth.setCustomUserClaims(uid, {
    ...(currentUser.customClaims ?? {}),
    roles: nextRoles,
  })

  return { roles: nextRoles }
})
