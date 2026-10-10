import { useMemo, useSyncExternalStore } from 'react'
import { getPendingUploads, subscribePendingUploads } from '@/services/offline/pendingUploads.js'

/**
 * The photos and maps waiting to upload (pendingUploads.js), kept current.
 *
 * @param {(upload: object) => boolean} [filter] - Which of them (e.g. a cave's photos).
 * @returns {object[]}
 */
export function usePendingUploads(filter) {
  const all = useSyncExternalStore(subscribePendingUploads, getPendingUploads, getPendingUploads)
  return useMemo(() => (filter ? all.filter(filter) : all), [all, filter])
}
