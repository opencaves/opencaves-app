import { useMemo } from 'react'
import { buildIndexData, sistemaSlugs } from '@/utils/indexData.js'
import { useCaveData } from '@/hooks/useCaveData.js'

/**
 * The public index pages' data (utils/indexData.js), from the store, which
 * App keeps subscribed to Firestore (or, on a page the server rendered, from
 * the data it sent: {@link useCaveData}).
 *
 * @returns {{data: object, partial: boolean, loading: boolean, failed: boolean}} loading: nothing to show yet (a first
 *   visit); failed: the data couldn't be read and there's none stored;
 *   partial: the server's part of the data only (its page's), the rest to come.
 */
export function useIndexData() {
  const { caves, sistemas, areas, connections, dataLoadingState, partial = false } = useCaveData()
  const data = useMemo(() => buildIndexData({ caves, sistemas, areas, connections }), [caves, sistemas, areas, connections])
  const empty = caves.length === 0 && !partial
  return { data, partial, loading: empty && dataLoadingState.state === 'loading', failed: empty && dataLoadingState.state === 'error' }
}

/**
 * Every public sistema's address slug by id, for links to /sistemas/<id>.
 *
 * @returns {Map<string, string>}
 */
export function useSistemaSlugs() {
  const { sistemas } = useCaveData()
  return useMemo(() => sistemaSlugs(sistemas), [sistemas])
}
