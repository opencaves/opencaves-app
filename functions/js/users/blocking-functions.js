import { beforeUserCreated } from 'firebase-functions/v2/identity'
// import { log } from 'firebase-functions/logger'
import { auth, db } from '../init.js'

export const beforeCreated = beforeUserCreated(async event => {
  const users = db.collection('users')
  const user = event.data
  const { uid, email } = user

  try {

    await auth.setCustomUserClaims(uid, { roles: ['editor'] })

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