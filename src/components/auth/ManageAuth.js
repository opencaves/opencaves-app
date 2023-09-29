import { useDispatch } from 'react-redux'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebase'
import { setUser } from '@/redux/slices/sessionSlice'

export default function ManageAuth() {
  const dispatch = useDispatch()

  onAuthStateChanged(auth, user => dispatch(setUser(user)))
}