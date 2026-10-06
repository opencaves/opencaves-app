import { useMemo, useSyncExternalStore } from 'react'
import { getPendingUploads, subscribePendingUploads } from '@/services/offline/pendingUploads.js'

// The photos and maps waiting to upload (pendingUploads.js), kept current;
// filter: which of them (e.g. a cave's photos).
export function usePendingUploads(filter) {
  const all = useSyncExternalStore(subscribePendingUploads, getPendingUploads, getPendingUploads)
  return useMemo(() => (filter ? all.filter(filter) : all), [all, filter])
}
