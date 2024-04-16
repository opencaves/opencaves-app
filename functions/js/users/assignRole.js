import functions from 'firebase-functions'
import { auth } from '../init.js'
import { REGION } from '../constants.js'

export const assignRole = functions
  .region(REGION)
  .auth
  .user()
  .onCreate(async user => {
    const { uid, providerData } = user
    const roles = [providerData.length === 0 ? 'guest' : 'editor']

    await auth.setCustomUserClaims(uid, { roles })
  })