import functions from 'firebase-functions'
import { auth } from '../init.js'
import { region } from '../constants.js'

export const assignRole = functions
  .region(region)
  .auth
  .user()
  .onCreate(async user => {
    // const auth = getAuth()
    const { uid, isAnonymous } = user
    const roles = [isAnonymous ? 'guest' : 'editor']

    await auth.setCustomUserClaims(uid, { roles })
  })