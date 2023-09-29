import { beforeUserCreated } from 'firebase-functions/v2/identity'
import { auth, db } from '../init.js'

export const beforeCreated = beforeUserCreated({ region: 'northamerica-northeast1' }, async event => {
  const users = db.collection('users')
  const user = event.data
  const { uid, email } = user

  try {

    // if (user.email && !user.emailVerified) {
    //   throw new HttpsError(
    //     'invalid-argument', 'Unverified email')
    // }

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