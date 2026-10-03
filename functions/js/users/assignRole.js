import * as functions from 'firebase-functions/v1'
import { auth } from '../init.js'
import { REGION } from '../constants.js'
import { hasVerifiedEmail } from './verifiedEmail.js'

export const assignRole = functions
  .region(REGION)
  .auth
  .user()
  .onCreate(async user => {
    // Editors need a known email (see verifiedEmail.js); the others get the
    // role later through ensureEditorRole, once their email is verified.
    const roles = hasVerifiedEmail(user) ? ['editor'] : ['guest']
    const { uid } = user

    await auth.setCustomUserClaims(uid, { roles })
  })