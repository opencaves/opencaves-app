import { useDispatch, useSelector } from 'react-redux'
import { setTitle } from '@/redux/slices/appSlice.jsx'
import { APP_TITLE } from '@/config/app.js'

export function useTitle() {

  const dispatch = useDispatch()
  const title = useSelector((/** @type {RootState} */ state) => state.app.title)

  return {
    title,
    setTitle: (title) => {
      dispatch(setTitle(title ? `${title} / ${APP_TITLE}` : APP_TITLE))
    }
  }
}