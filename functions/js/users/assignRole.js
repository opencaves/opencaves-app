import { user } from 'firebase-functions/v1/auth'
import { auth } from '../init.js'

export const assignRole = user().onCreate(async user => {
  // const auth = getAuth()
  const { uid, isAnonymous } = user
  const roles = [isAnonymous ? 'guest' : 'editor']

  await auth.setCustomUserClaims(uid, { roles })
})