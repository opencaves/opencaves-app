import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { arrayUnion } from 'firebase/firestore'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { uploadMapFile } from '@/components/MapsPicker/MapUpload.jsx'
import CaveAsset from '@/models/CaveAsset.js'
import SistemaModel from '@/models/SistemaModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { isMeteredConnection } from '@/services/offline/offlineMedia.js'
import { loadPendingUploads, removePendingUpload, subscribePendingUploads, updatePendingUpload } from '@/services/offline/pendingUploads.js'

// How often to look again while the app is open (a Wi-Fi network may come
// back without an 'online' event: from cellular to Wi-Fi).
const RETRY_MS = 60000

// Storage and Firestore errors that only mean "not now" (the connection
// dropped, the server busy): the upload waits for the next try. Any other
// (refused by the rules, a file gone bad) marks it failed.
const TRANSIENT = /network|retry-limit|unavailable|deadline|unknown|offline|canceled|cancelled/i

/**
 * Uploads the photos and maps added offline (pendingUploads.js), one at a
 * time, while the app is open, online and on Wi-Fi (not on mobile data or
 * with data saver, where the browser can tell) - each by the account that
 * added it. Says each is uploaded, or couldn't be.
 */
export default function PendingUploadsSync() {
  const uid = useSelector((/** @type {RootState} */ state) => state.session.user?.uid)
  const isLoggedIn = useSelector((/** @type {RootState} */ state) => state.session.isLoggedIn)
  const { t } = useTranslation('offline', { keyPrefix: 'pending' })
  const [openSnackbar] = useSnackbar()
  const running = useRef(false)
  const latest = useRef({ t, openSnackbar })
  latest.current = { t, openSnackbar }

  useEffect(() => {
    if (!uid || !isLoggedIn) return undefined
    let stopped = false

    async function run() {
      if (running.current || stopped || !navigator.onLine || isMeteredConnection()) return
      running.current = true
      try {
        const mine = (await loadPendingUploads()).filter((item) => item.uid === uid && item.state === 'waiting')
        for (const item of mine) {
          if (stopped || !navigator.onLine || isMeteredConnection()) break
          const { t, openSnackbar } = latest.current
          try {
            if (item.kind === 'map') {
              const map = await uploadMapFile(item.file, item.details, { id: item.id })
              // Added from a system's maps list: added to it now.
              if (item.sistemaId) await SistemaModel.save(item.sistemaId, { maps: arrayUnion(map.id) })
              invalidateData()
              getData().catch((error) => console.warn(error))
              openSnackbar(t('mapUploaded', { name: item.details?.title || item.name }), { severity: 'success' })
            } else {
              await new CaveAsset({ caveId: item.caveId, userId: uid }).upload(item.file, () => {})
              openSnackbar(t('photoUploaded', { name: item.name }), { severity: 'success' })
            }
            await removePendingUpload(item.id)
          } catch (error) {
            if (TRANSIENT.test(`${error?.code} ${error?.message}`)) break
            console.error('[PendingUploadsSync]', error)
            await updatePendingUpload(item.id, { state: 'failed', error: String(error?.code || error?.message || error) })
            openSnackbar(item.kind === 'map' ? t('mapFailed', { name: item.details?.title || item.name }) : t('photoFailed', { name: item.name }), { autoHide: false })
          }
        }
      } finally {
        running.current = false
      }
    }

    run()
    const unsubscribe = subscribePendingUploads(() => run())
    window.addEventListener('online', run)
    const interval = setInterval(run, RETRY_MS)
    return () => {
      stopped = true
      unsubscribe()
      window.removeEventListener('online', run)
      clearInterval(interval)
    }
  }, [uid, isLoggedIn])

  return null
}
