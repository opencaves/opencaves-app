import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/config/firebase'

export default function Logout() {
  const navigate = useNavigate()
  signOut(auth).then(() => {
    // Sign-out successful.
    navigate('/')
  }).catch((error) => {
    // An error happened.

    return <>{error}</>
  })
}