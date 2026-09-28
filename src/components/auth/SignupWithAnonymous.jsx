import { signInAnonymously } from 'firebase/auth'
import { useEffect } from 'react'
import { auth } from '@/config/firebase.js'
import useAnonymous from '@/hooks/useAnonymous.jsx'
import useLoggedIn from '@/hooks/useLoggedin.jsx'

export default function SignupWithAnonymous() {
  const isLoggedIn = useLoggedIn()
  const isAnonymous = useAnonymous()

  useEffect(() => {
    if (!isLoggedIn && !isAnonymous) {
      async function signupWithAnonymous() {
        try {
          await signInAnonymously(auth)

        } catch (error) {
          console.error(error)
        }
      }

      signupWithAnonymous()
    }
  }, [isLoggedIn, isAnonymous])
}