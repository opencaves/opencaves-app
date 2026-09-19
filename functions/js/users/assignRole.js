import functions from 'firebase-functions'
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