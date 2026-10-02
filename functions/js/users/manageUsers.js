import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { auth } from '../init.js'
import { REGION } from '../constants.js'

const ASSIGNABLE_ROLES = ['editor', 'admin']

function requireAdmin(request) {
  const roles = request.auth?.token?.roles
  if (!request.auth || !Array.isArray(roles) || !roles.includes('admin')) {
    throw new HttpsError('permission-denied', 'Only admins can manage users.')
  }
}

// Firebase Auth's listUsers() is paginated at up to 1000 users per call, so
// every page has to be walked to return the full set.
async function listAllAuthUsers() {
  const users = []
  let pageToken

  do {
    const page = await auth.listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)

  return users
}

export const listUsers = onCall({ region: REGION }, async request => {
  requireAdmin(request)

  const users = await listAllAuthUsers()

  return {
    users: users
      // Anonymous, email-less accounts are transient guest sessions, not
      // registered users - nothing meaningful to manage for them here.
      .filter(user => !!user.email)
      .map(user => ({
        uid: user.uid,
        email: user.email,
        disabled: user.disabled,
        roles: Array.isArray(user.customClaims?.roles) ? user.customClaims.roles : [],
        frozen: !!user.customClaims?.frozen,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
  }
})

export const setUserRoles = onCall({ region: REGION }, async request => {
  requireAdmin(request)

  const { uid, roles } = request.data ?? {}

  if (typeof uid !== 'string' || !uid) {
    throw new HttpsError('invalid-argument', 'A user uid is required.')
  }

  if (!Array.isArray(roles) || roles.some(role => !ASSIGNABLE_ROLES.includes(role))) {
    throw new HttpsError('invalid-argument', `roles must only contain: ${ASSIGNABLE_ROLES.join(', ')}`)
  }

  // The other claims (frozen...) kept; a frozen account's roles wait for it to
  // be unfrozen.
  const { customClaims = {} } = await auth.getUser(uid)
  if (customClaims.frozen) {
    throw new HttpsError('failed-precondition', 'Unfreeze this account before changing its roles.')
  }
  await auth.setCustomUserClaims(uid, { ...customClaims, roles })

  return { roles }
})

// Freezes an account: all its editing rights removed (its roles emptied, kept
// in frozenRoles for unfreezing), and the auto-granted editor role
// (ensureEditorRole) withheld while frozen. Its sessions are revoked: its
// current ID token still works until it expires (up to an hour), then it
// signs in again without them. Unfreezing gives its roles back.
export const setUserFrozen = onCall({ region: REGION }, async request => {
  requireAdmin(request)

  const { uid, frozen } = request.data ?? {}

  if (typeof uid !== 'string' || !uid || typeof frozen !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A user uid and frozen (true or false) are required.')
  }

  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot freeze your own account.')
  }

  const { customClaims = {} } = await auth.getUser(uid)
  const { frozen: wasFrozen, frozenRoles, ...claims } = customClaims
  const roles = Array.isArray(claims.roles) ? claims.roles : []

  if (frozen) {
    if (!wasFrozen) {
      await auth.setCustomUserClaims(uid, { ...claims, roles: [], frozen: true, frozenRoles: roles })
      await auth.revokeRefreshTokens(uid)
    }
    return { frozen: true, roles: [] }
  }

  const restored = Array.isArray(frozenRoles) && frozenRoles.length ? frozenRoles : ['editor']
  await auth.setCustomUserClaims(uid, { ...claims, roles: restored })
  return { frozen: false, roles: restored }
})

export const deleteUser = onCall({ region: REGION }, async request => {
  requireAdmin(request)

  const { uid } = request.data ?? {}

  if (typeof uid !== 'string' || !uid) {
    throw new HttpsError('invalid-argument', 'A user uid is required.')
  }

  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own account.')
  }

  // Deleting via the Admin SDK still fires the existing auth.user().onDelete
  // trigger (users/onDelete.js), which cleans up the matching Firestore
  // users/{uid} doc - no extra cleanup needed here.
  await auth.deleteUser(uid)

  return { uid }
})
