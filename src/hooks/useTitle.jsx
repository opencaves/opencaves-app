import { useDispatch, useSelector } from 'react-redux'
import { setTitle } from '@/redux/slices/appSlice.jsx'
import { TITLE_NAME } from '@/config/app.js'

/**
 * The page's <title>, and its setter: "<title> / Open Caves" ({@link TITLE_NAME}
 * alone without one); `full` sets a title that already names the app (the
 * landing page's) as it is.
 *
 * @returns {{title: string, setTitle: (title?: string, options?: {full?: boolean}) => void}}
 */
export function useTitle() {

  const dispatch = useDispatch()
  const title = useSelector((/** @type {RootState} */ state) => state.app.title)

  return {
    title,
    setTitle: (title, { full = false } = {}) => {
      dispatch(setTitle(title ? (full ? title : `${title} / ${TITLE_NAME}`) : TITLE_NAME))
    }
  }
}