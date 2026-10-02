import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { REGION, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'

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

// The emails to a frozen, then unfrozen, account, in its language
// (users/{uid}.language).
const FROZEN_EMAIL = {
  en: {
    subject: 'Your OpenCaves editing rights are suspended',
    text: 'Hello,\n\nAn OpenCaves administrator has suspended your editing rights on opencaves.org. You can still browse the map and your saved cenotes, but you can no longer edit cenotes, systems or photos.\n\nIf you think this is a mistake, contact an OpenCaves administrator.\n\nThe OpenCaves team',
  },
  fr: {
    subject: 'Vos droits de modification OpenCaves sont suspendus',
    text: 'Bonjour,\n\nUn administrateur d\u2019OpenCaves a suspendu vos droits de modification sur opencaves.org. Vous pouvez toujours consulter la carte et vos cénotes enregistrées, mais vous ne pouvez plus modifier les cénotes, les systèmes ni les photos.\n\nSi vous pensez qu\u2019il s\u2019agit d\u2019une erreur, contactez un administrateur d\u2019OpenCaves.\n\nL\u2019équipe OpenCaves',
  },
  es: {
    subject: 'Tus permisos de edición en OpenCaves están suspendidos',
    text: 'Hola:\n\nUn administrador de OpenCaves ha suspendido tus permisos de edición en opencaves.org. Puedes seguir consultando el mapa y tus cenotes guardados, pero ya no puedes editar cenotes, sistemas ni fotos.\n\nSi crees que se trata de un error, contacta a un administrador de OpenCaves.\n\nEl equipo de OpenCaves',
  },
}

const UNFROZEN_EMAIL = {
  en: {
    subject: 'Your OpenCaves editing rights are restored',
    text: 'Hello,\n\nAn OpenCaves administrator has restored your editing rights on opencaves.org: you can edit cenotes, systems and photos again. Sign out and back in if the editing tools don\u2019t show yet.\n\nThe OpenCaves team',
  },
  fr: {
    subject: 'Vos droits de modification OpenCaves sont rétablis',
    text: 'Bonjour,\n\nUn administrateur d\u2019OpenCaves a rétabli vos droits de modification sur opencaves.org : vous pouvez de nouveau modifier les cénotes, les systèmes et les photos. Déconnectez-vous puis reconnectez-vous si les outils de modification n\u2019apparaissent pas encore.\n\nL\u2019équipe OpenCaves',
  },
  es: {
    subject: 'Tus permisos de edición en OpenCaves están restablecidos',
    text: 'Hola:\n\nUn administrador de OpenCaves ha restablecido tus permisos de edición en opencaves.org: puedes volver a editar cenotes, sistemas y fotos. Cierra la sesión y vuelve a iniciarla si las herramientas de edición aún no aparecen.\n\nEl equipo de OpenCaves',
  },
}

// Tells the account it was frozen or unfrozen (emails: FROZEN_EMAIL or
// UNFROZEN_EMAIL), to it alone. A failure is logged, not thrown:
// the change is made either way.
async function emailAccount(user, emails) {
  if (!user.email) return false
  try {
    const language = (await db.collection(USERS_COLL_NAME).doc(user.uid).get()).get('language')
    const { subject, text } = emails[language] || emails.en
    const result = await sendEmail({ to: user.email, subject, text })
    return result.sent
  } catch (error) {
    logger.error('[setUserFrozen] the email could not be sent', { uid: user.uid, error: error.message })
    return false
  }
}

// Freezes an account: all its editing rights removed (its roles emptied, kept
// in frozenRoles for unfreezing), and the auto-granted editor role
// (ensureEditorRole) withheld while frozen. Its sessions are revoked: its
// current ID token still works until it expires (up to an hour), then it
// signs in again without them. Unfreezing gives its roles back. The account
// is told both times by email.
export const setUserFrozen = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async request => {
  requireAdmin(request)

  const { uid, frozen } = request.data ?? {}

  if (typeof uid !== 'string' || !uid || typeof frozen !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A user uid and frozen (true or false) are required.')
  }

  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot freeze your own account.')
  }

  const user = await auth.getUser(uid)
  const { customClaims = {} } = user
  const { frozen: wasFrozen, frozenRoles, ...claims } = customClaims
  const roles = Array.isArray(claims.roles) ? claims.roles : []

  if (frozen) {
    let emailed = false
    if (!wasFrozen) {
      await auth.setCustomUserClaims(uid, { ...claims, roles: [], frozen: true, frozenRoles: roles })
      await auth.revokeRefreshTokens(uid)
      emailed = await emailAccount(user, FROZEN_EMAIL)
    }
    return { frozen: true, roles: [], emailed }
  }

  if (!wasFrozen) {
    return { frozen: false, roles, emailed: false }
  }
  const restored = Array.isArray(frozenRoles) && frozenRoles.length ? frozenRoles : ['editor']
  await auth.setCustomUserClaims(uid, { ...claims, roles: restored })
  const emailed = await emailAccount(user, UNFROZEN_EMAIL)
  return { frozen: false, roles: restored, emailed }
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
