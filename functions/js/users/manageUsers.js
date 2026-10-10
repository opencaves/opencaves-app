import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { ENFORCE_APP_CHECK, FROZEN_USERS_COLL_NAME, REGION, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { renderNotice } from '../email/layout.js'
import { writeAuditLog } from '../audit/log.js'
import { requireAdmin as requireAdminRole } from './requireAdmin.js'

const ASSIGNABLE_ROLES = ['editor', 'admin']

const requireAdmin = (request) => requireAdminRole(request, 'Only admins can manage users.')

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

export const listUsers = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async request => {
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
        displayName: user.displayName ?? null,
        disabled: user.disabled,
        roles: Array.isArray(user.customClaims?.roles) ? user.customClaims.roles : [],
        frozen: !!user.customClaims?.frozen,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
  }
})

export const setUserRoles = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async request => {
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
  const wasAdmin = Array.isArray(customClaims.roles) && customClaims.roles.includes('admin')
  if (wasAdmin && !roles.includes('admin')) {
    // An admin can't demote themselves (another admin must), and the last
    // admin can't be demoted: no one could manage the users any more.
    if (uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'You cannot remove your own admin role.')
    }
    const admins = (await listAllAuthUsers()).filter(user => user.customClaims?.roles?.includes?.('admin') && !user.customClaims?.frozen)
    if (admins.length <= 1) {
      throw new HttpsError('failed-precondition', 'This is the last admin.')
    }
  }

  await auth.setCustomUserClaims(uid, { ...customClaims, roles })
  await writeAuditLog({ action: 'setRoles', collection: USERS_COLL_NAME, docId: uid, authorId: request.auth.uid, before: customClaims.roles || [], roles })

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
    const lang = emails[language] ? language : 'en'
    const { subject, text: body } = emails[lang]
    // The subject is its title, its paragraphs the text's.
    const { html, text } = renderNotice({ language: lang, title: subject, paragraphs: body.split('\n\n') })
    const result = await sendEmail({ to: user.email, subject, html, text })
    return result.sent
  } catch (error) {
    logger.error('[setUserFrozen] the email could not be sent', { uid: user.uid, error: error.message })
    return false
  }
}

/**
 * Freezes an account: all its editing rights removed (its roles emptied, kept
 * in frozenRoles for unfreezing), and the auto-granted editor role
 * (ensureEditorRole) withheld while frozen. Its sessions are revoked: its
 * current ID token still works until it expires (up to an hour), then it
 * signs in again without them. Unfreezing gives its roles back. The account
 * is told both times by email.
 *
 * @param {CallableRequest} request - Its data: { uid, frozen }.
 * @throws {HttpsError} permission-denied when the caller isn't an admin ({@link requireAdmin});
 *   invalid-argument without uid and frozen; failed-precondition for the caller's own account.
 */
export const setUserFrozen = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, secrets: [RESEND_API_KEY] }, async request => {
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
      // The rules refuse it from now on, not once its token expires.
      await db.collection(FROZEN_USERS_COLL_NAME).doc(uid).set({ frozenBy: request.auth.uid, at: new Date() })
      await auth.revokeRefreshTokens(uid)
      await writeAuditLog({ action: 'freeze', collection: USERS_COLL_NAME, docId: uid, authorId: request.auth.uid, roles })
      emailed = await emailAccount(user, FROZEN_EMAIL)
    }
    return { frozen: true, roles: [], emailed }
  }

  if (!wasFrozen) {
    return { frozen: false, roles, emailed: false }
  }
  const restored = Array.isArray(frozenRoles) && frozenRoles.length ? frozenRoles : ['editor']
  await auth.setCustomUserClaims(uid, { ...claims, roles: restored })
  await db.collection(FROZEN_USERS_COLL_NAME).doc(uid).delete()
  await writeAuditLog({ action: 'unfreeze', collection: USERS_COLL_NAME, docId: uid, authorId: request.auth.uid, roles: restored })
  const emailed = await emailAccount(user, UNFROZEN_EMAIL)
  return { frozen: false, roles: restored, emailed }
})

export const deleteUser = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async request => {
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
  const { email, customClaims = {} } = await auth.getUser(uid)
  await auth.deleteUser(uid)
  await db.collection(FROZEN_USERS_COLL_NAME).doc(uid).delete()
  await writeAuditLog({ action: 'deleteUser', collection: USERS_COLL_NAME, docId: uid, authorId: request.auth.uid, email: email || null, roles: customClaims.roles || [] })

  return { uid }
})
