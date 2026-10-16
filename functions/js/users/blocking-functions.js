import { beforeUserCreated } from 'firebase-functions/v2/identity'
import { db } from '../init.js'
import { USERS_COLL_NAME } from '../constants.js'
import { hasVerifiedEmail } from './verifiedEmail.js'

/**
 * A new account, before Firebase Auth saves it: its `_users` document, and its
 * role in the token's claims - editor when its email is known to be the
 * person's ({@link hasVerifiedEmail}), else guest, until `ensureEditorRole`
 * makes it an editor once the email is verified. Returned as `customClaims`
 * (a blocking function can't call setCustomUserClaims: the user doesn't exist
 * yet); the Gen1 onCreate trigger that set them before can't run Node 24.
 */
export const onBeforeUserCreated = beforeUserCreated(async event => {
  const user = event.data
  const { uid, email } = user
  const roles = hasVerifiedEmail(user) ? ['editor'] : ['guest']

  try {
    await db.collection(USERS_COLL_NAME).doc(uid).set({
      email,
      savedPlaces: []
    })
  } catch (error) {
    // The account is still created, with its role.
    console.error(error)
  }

  return { customClaims: { roles } }
})
