import { beforeUserCreated } from 'firebase-functions/v2/identity'
// import { log } from 'firebase-functions/logger'
import { db } from '../init.js'

export const onBeforeUserCreated = beforeUserCreated(async event => {
  const users = db.collection('users')
  const user = event.data
  const { uid, email } = user

  // Role assignment happens in assignRole.js's onCreate trigger, which runs
  // after the user actually exists: auth.setCustomUserClaims() throws
  // auth/user-not-found if called here, since beforeUserCreated fires before
  // the user record is persisted.
  try {
    const userRef = users.doc(uid)
    await userRef.set({
      email,
      savedPlaces: []
    })

    return
  } catch (error) {
    console.error(error)

  }
})

// export const beforesignedin = beforeUserSignedIn((event) => {
//   // TODO
// })