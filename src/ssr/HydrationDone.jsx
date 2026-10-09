import { useEffect } from 'react'
import { persistor } from '@/redux/store.jsx'
import { setHydrating } from './ssrContext.js'

// Last in the hydrated tree (index.jsx): its effect runs once the whole page
// is hydrated - the server's query results (ssrContext.js) are then no
// longer offered to the components mounting after, and the stored state
// (redux-persist, store.jsx) is read.
export default function HydrationDone() {
  useEffect(() => {
    setHydrating(false)
    delete window.__OC_SSR__?.queries
    persistor.persist()
  }, [])
  return null
}
