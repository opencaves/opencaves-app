import { useDispatch, useSelector } from 'react-redux'
import { setTitle } from '@/redux/slices/appSlice.jsx'
import { appTitle } from '@/config/app.js'

export function useTitle() {

  const dispatch = useDispatch()
  const title = useSelector(state => state.app.title)

  return {
    title,
    setTitle: (title) => {
      dispatch(setTitle(title ? `${title} / ${appTitle}` : appTitle))
    }
  }
}