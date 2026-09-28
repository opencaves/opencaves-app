import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { useOfflinePreviewsEnabled } from '@/hooks/useOfflinePreviewsSetting.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { requestPersistentStorage } from '@/utils/persistentStorage.js'
import { canDownload, clearPreviews, consumeJustSaved, getPreviewUrls, getSavedCaveUrls, offlineSupported, previewsStatusKey, savedCaveStatusKey, setWaiting, syncPreviews, syncSavedCaves } from '@/services/offline/offlineMedia.js'

// Bumps whenever the network may have become usable for downloads (back
// online, or a connection type change such as cellular -> Wi-Fi).
function useNetworkChangeTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('online', bump)
    navigator.connection?.addEventListener?.('change', bump)
    return () => {
      window.removeEventListener('online', bump)
      navigator.connection?.removeEventListener?.('change', bump)
    }
  }, [])
  return tick
}

// Keeps the offline caches in line with what should be available offline on
// this device - every saved cenote's pictures and maps, and (when turned on)
// every cave's cover thumbnail - and reports finished downloads. Renders
// nothing; mounted once in App, inside the SnackbarProvider.
export default function OfflineMediaSync() {
  const { t } = useTranslation('offline')
  const { t: tMap } = useTranslation('map')
  const [openSnackbar] = useSnackbar()
  const { canSave, loading, savedCaveIds } = useSavedCaves()
  const previewsEnabled = useOfflinePreviewsEnabled()
  const caves = useSelector((state) => state.data.caves)
  const sistemas = useSelector((state) => state.data.sistemas)
  const connections = useSelector((state) => state.data.connections)
  const networkTick = useNetworkChangeTick()
  // Read inside async callbacks without re-running the effects.
  const latest = useRef({})
  latest.current = { t, tMap, openSnackbar, caves }

  // Saved cenotes. Signed out, the cache is left as-is rather than wiped
  // (its content is public), and auth still resolving at startup mustn't
  // look like "nothing saved".
  useEffect(() => {
    if (!offlineSupported || !canSave || loading || caves.length === 0) return undefined
    if (!canDownload()) {
      savedCaveIds.forEach((caveId) => setWaiting(savedCaveStatusKey(caveId)))
      return undefined
    }

    const controller = new AbortController()
    // Debounced: saving several cenotes in a row syncs once.
    const timeoutId = setTimeout(async () => {
      try {
        if (savedCaveIds.length > 0) requestPersistentStorage()
        const urlLists = await Promise.all(savedCaveIds.map((caveId) => getSavedCaveUrls(caveId, { caves, sistemas, connections })))
        if (controller.signal.aborted) return
        const urlsByCave = Object.fromEntries(savedCaveIds.map((caveId, index) => [caveId, urlLists[index]]))

        await syncSavedCaves(urlsByCave, {
          signal: controller.signal,
          onCaveDone: (caveId, { failed }) => {
            if (!consumeJustSaved(caveId)) return
            const { t, tMap, openSnackbar, caves } = latest.current
            const name = caves.find((cave) => cave.id === caveId)?.name?.value || tMap('caveNameUnknown')
            openSnackbar(failed > 0 ? t('caveIncomplete', { name }) : t('caveReady', { name }))
          },
        })
      } catch (error) {
        console.warn('[offline] Saved cenotes sync failed: %o', error)
      }
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [canSave, loading, savedCaveIds, caves, sistemas, connections, networkTick])

  // Cover thumbnails of every cave.
  useEffect(() => {
    if (!offlineSupported) return undefined
    if (!previewsEnabled) {
      clearPreviews()
      return undefined
    }
    if (caves.length === 0) return undefined
    if (!canDownload()) {
      setWaiting(previewsStatusKey)
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      try {
        requestPersistentStorage()
        const urls = await getPreviewUrls()
        if (controller.signal.aborted) return
        const result = await syncPreviews(urls, { signal: controller.signal })
        // Only announce an actual download, not a check that found
        // everything already there.
        if (result && result.downloaded + result.failed > 0) {
          const { t, openSnackbar } = latest.current
          openSnackbar(result.failed > 0 ? t('previewsIncomplete') : t('previewsReady'))
        }
      } catch (error) {
        console.warn('[offline] Previews sync failed: %o', error)
      }
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [previewsEnabled, caves, networkTick])

  return null
}
