import { auth } from '@/config/firebase.js'
import useAnonymous from '@/hooks/useAnonymous.js'
import useLoggedIn from '@/hooks/useLoggedin'
import { signInAnonymously } from 'firebase/auth'
import { useEffect } from 'react'

export default function SignupWithAnonymous() {
  const isLoggedIn = useLoggedIn()
  const isAnonymous = useAnonymous()

  useEffect(() => {
    if (!isLoggedIn && !isAnonymous) {
      async function signupWithAnonymous() {
        try {
          await signInAnonymously(auth)
          console.log('Signed in anonymously')

        } catch (error) {
          console.error(error)
        }
      }

      signupWithAnonymous()
    }
  }, [isLoggedIn, isAnonymous])
}