import { useDispatch } from 'react-redux'
import { onAuthStateChanged } from 'firebase/auth'
import { setUser } from '@/redux/slices/sessionSlice.jsx'
import { auth } from '@/config/firebase.js'

export default function ManageAuth() {
  const dispatch = useDispatch()

  onAuthStateChanged(auth, user => dispatch(setUser(user ? user.toJSON() : user)))
}