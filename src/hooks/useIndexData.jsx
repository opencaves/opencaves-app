import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { buildIndexData, sistemaSlugs } from '@/utils/indexData.js'

// The public index pages' data (utils/indexData.js), from the store, which
// App keeps subscribed to Firestore. loading: nothing to show yet (a first
// visit); failed: the data couldn't be read and there's none stored.
export function useIndexData() {
  const caves = useSelector((state) => state.data.caves)
  const sistemas = useSelector((state) => state.data.sistemas)
  const areas = useSelector((state) => state.data.areas)
  const connections = useSelector((state) => state.data.connections)
  const loadingState = useSelector((state) => state.data.dataLoadingState.state)
  const data = useMemo(() => buildIndexData({ caves, sistemas, areas, connections }), [caves, sistemas, areas, connections])
  const empty = caves.length === 0
  return { data, loading: empty && loadingState === 'loading', failed: empty && loadingState === 'error' }
}

// Every public sistema's address slug by id, for links to /sistemas/<slug>.
export function useSistemaSlugs() {
  const sistemas = useSelector((state) => state.data.sistemas)
  return useMemo(() => sistemaSlugs(sistemas), [sistemas])
}
