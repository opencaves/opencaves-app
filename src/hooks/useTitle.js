import { useDispatch, useSelector } from 'react-redux'
import { setTitle } from '../redux/slices/appSlice'

export function useTitle() {

  const defaultTitle = useSelector(state => state.app.name)
  const title = useSelector(state => state.app.title)
  const dispatch = useDispatch()

  return {
    title,
    setTitle: (title) => {
      dispatch(setTitle(title ? `Cenote ${title} / ${defaultTitle}` : defaultTitle))
    }
  }
}