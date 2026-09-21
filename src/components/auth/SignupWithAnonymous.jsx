import { signInAnonymously } from 'firebase/auth'
import { useEffect } from 'react'
import { auth } from '@/config/firebase.js'
import useAnonymous from '@/hooks/useAnonymous.jsx'
import useLoggedIn from '@/hooks/useLoggedin.jsx'

export default function SignupWithAnonymous() {
  const isLoggedIn = useLoggedIn()
  const isAnonymous = useAnonymous()

  useEffect(() => {
    console.log('111111111111111111111')
    if (!isLoggedIn && !isAnonymous) {
      console.log('2222222222222222222222')
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