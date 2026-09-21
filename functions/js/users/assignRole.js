import * as functions from 'firebase-functions/v1'
import { auth } from '../init.js'
import { REGION } from '../constants.js'

export const assignRole = functions
  .region(REGION)
  .auth
  .user()
  .onCreate(async user => {
    const { uid, email, isAnonymous } = user
    const roles = isAnonymous || !email ? ['guest'] : ['editor']

    await auth.setCustomUserClaims(uid, { roles })
  })