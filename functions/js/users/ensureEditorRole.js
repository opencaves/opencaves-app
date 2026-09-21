import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { auth } from '../init.js'
import { REGION } from '../constants.js'

export const ensureEditorRole = onCall({ region: REGION }, async request => {
  const uid = request.auth?.uid

  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to ensure editor permissions.')
  }

  const currentUser = await auth.getUser(uid)
  const currentRoles = Array.isArray(currentUser.customClaims?.roles)
    ? currentUser.customClaims.roles
    : []

  if (currentRoles.includes('editor')) {
    return { roles: currentRoles }
  }

  const nextRoles = [...new Set([...currentRoles, 'editor'])]
  await auth.setCustomUserClaims(uid, {
    ...(currentUser.customClaims ?? {}),
    roles: nextRoles,
  })

  return { roles: nextRoles }
})
