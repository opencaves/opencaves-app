import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { inSsrPage, ssrPageData } from '@/ssr/ssrContext.js'

// The cave data (the store's state.data: caves, sistemas, areas...), as the
// public pages read it. On a page the server rendered (entry-server.jsx),
// until the store has its own (stored, then Firestore's), the part the server
// sent with the page (src/ssr/pageState.js): only what that page shows, the
// same records, with partial: true. Only on that page (and its galleries):
// another page waits for the store's, as on a first visit.
export function useCaveData() {
  const data = useSelector((state) => state.data)
  const { pathname } = useLocation()
  const page = ssrPageData()
  return page && data.caves.length === 0 && inSsrPage(page.path, pathname) ? page.data : data
}
