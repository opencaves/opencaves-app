import { auth, db } from '../init.js'
import { USERS_COLL_NAME } from '../constants.js'

/**
 * The admins to email: { uid, email, language } of each enabled account with
 * the admin role and an email, its language its account's
 * (_users/{uid}.language, two letters; 'en' when unset).
 *
 * @returns {Promise<{uid: string, email: string, language: string}[]>}
 */
export async function adminRecipients() {
  const admins = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) if (user.email && !user.disabled && Array.isArray(user.customClaims?.roles) && user.customClaims.roles.includes('admin')) admins.push({ uid: user.uid, email: user.email })
    pageToken = page.pageToken
  } while (pageToken)
  const settings = admins.length ? await db.getAll(...admins.map((admin) => db.collection(USERS_COLL_NAME).doc(admin.uid))) : []
  return admins.map((admin, index) => ({ ...admin, language: String(settings[index].get('language') || 'en').slice(0, 2) }))
}
