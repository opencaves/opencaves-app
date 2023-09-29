import { useDispatch, useSelector } from 'react-redux'
import { setUser } from '@/redux/slices/sessionSlice'

export default function Account() {

  const user = useSelector(state => state.session.user)
  const dispatch = useDispatch()

  const handleSignOut = () => {
    dispatch(setUser())
  }

  return (
    <div className='center'>
      <div className='profile'>
        <h1>Profile</h1>
        <p>
          <strong>Name: </strong>{user?.name}
        </p>
        <p>
          <strong>Email: </strong>
          {`${user?.email}`}
        </p>
        <span onClick={handleSignOut}>Sign Out</span>
      </div>
    </div>
  )
}