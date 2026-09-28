import { useSyncExternalStore } from 'react'
import { getOfflineStatus, getSavedCavesStatuses, subscribeToOfflineStatus } from '@/services/offline/offlineMedia.js'

// Download status of one offline item (previewsStatusKey or
// savedCaveStatusKey(caveId)): { state, done, total, failed }, or undefined.
export function useOfflineStatus(key) {
  return useSyncExternalStore(subscribeToOfflineStatus, () => getOfflineStatus(key))
}

// Totals across every saved cenote, for the account page's summary line.
export function useSavedCavesOfflineSummary() {
  return useSyncExternalStore(subscribeToOfflineStatus, getSummary)
}

// Memoized on the underlying statuses so useSyncExternalStore gets a stable
// snapshot between changes.
let lastStatuses = null
let lastSummary = null
function getSummary() {
  const statuses = getSavedCavesStatuses().map(([, s]) => s)
  if (lastStatuses && statuses.length === lastStatuses.length && statuses.every((s, i) => s === lastStatuses[i])) {
    return lastSummary
  }
  lastStatuses = statuses
  lastSummary = statuses.length === 0 ? null : {
    state: statuses.some((s) => s.state === 'downloading') ? 'downloading' : statuses.some((s) => s.state === 'waiting') ? 'waiting' : statuses.some((s) => s.state === 'incomplete') ? 'incomplete' : 'ready',
    done: statuses.reduce((sum, s) => sum + (s.done || 0), 0),
    total: statuses.reduce((sum, s) => sum + (s.total || 0), 0),
  }
  return lastSummary
}
