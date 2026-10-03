import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { auth } from '../init.js'
import { REGION } from '../constants.js'
import { hasVerifiedEmail } from './verifiedEmail.js'

export const ensureEditorRole = onCall({ region: REGION }, async request => {
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
