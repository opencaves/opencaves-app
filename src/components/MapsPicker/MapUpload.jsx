import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Typography } from '@mui/material'
import { ErrorAlert } from '@/components/Alert.jsx'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import { UploadInfo } from '@/components/AddMedias/UploadMedias.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { auth, getStorageService } from '@/config/firebase.js'
import mapsModel from '@/models/MapModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { assertOnline } from '@/utils/assertOnline.js'
import { addPendingUpload } from '@/services/offline/pendingUploads.js'

/**
 * A map file sent to Storage and its record made.
 *
 * @param {File} file
 * @param {{title?: string, authors?: string[], date?: string, note?: string}} [details]
 * @param {object} [options]
 * @param {string} [options.id] - Its record's id - a waiting upload's reserved one (a new push id by default).
 * @param {(percent: number) => void} [options.onProgress] - Its percent sent.
 * @returns {Promise<CaveMap>} The map ({ id, ...record }).
 * @throws {Error} As the upload does (offline: code 'offline').
 */
export async function uploadMapFile(file, { title, authors = [], date, note } = {}, { id = pushId(), onProgress } = {}) {
  assertOnline()
  const isPdf = file.type === 'application/pdf'
  const { storage, ref, uploadBytesResumable, getDownloadURL } = await getStorageService()
  const storageRef = ref(storage, isPdf ? `maps/original-pdf/${id}` : `maps/${id}`)
  const task = uploadBytesResumable(storageRef, file)
  await new Promise((resolve, reject) => {
    task.on('state_changed', (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), reject, resolve)
  })
  const url = await getDownloadURL(storageRef)
  const map = { name: title, url, contentType: file.type, authors: authors.length > 0 ? authors : undefined, date: date || undefined, note: note || undefined }
  await mapsModel.save(id, map)
  return { id, ...map }
}

/**
 * A map's title always comes from the person uploading it (see MapUploadDetailsFields)
 * rather than being guessed from the file, so every map has a name the person
 * who added it actually chose.
 *
 * @returns {{uploadMap: Function, uploading: boolean, progress: number, current: *, error: *, clearError: () => void}}
 */
export function useMapUpload() {
  const { t } = useTranslation('mapsPicker')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(null)
  const [error, setError] = useState(null)
  const [openSnackbar] = useSnackbar()
  const { t: tOffline } = useTranslation('offline')

  // attachToSistemaId: offline, the system the map is to be added to once
  // uploaded (a system's maps list) - none when the caller lists it itself
  // (the edit form). Offline, the map is kept on the device (pendingUploads)
  // and returned as { id, pending: true, ...details }: it uploads later, on
  // Wi-Fi.
  async function uploadMap(file, details = {}, { attachToSistemaId = null } = {}) {
    const { title, authors = [], date, note } = details
    if (!file) return null
    setError(null)
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('invalidMapFile')
      return null
    }

    if (!navigator.onLine) {
      const id = pushId()
      try {
        await addPendingUpload({ id, kind: 'map', uid: auth.currentUser?.uid ?? null, file, name: file.name, details: { title, authors, date, note }, sistemaId: attachToSistemaId })
        openSnackbar(tOffline('pending.mapSaved', { name: title }), { severity: 'success' })
        return { id, pending: true, name: title, contentType: file.type }
      } catch (cause) {
        console.error(cause)
        setError('uploadError')
        return null
      }
    }

    setUploading(true)
    setProgress(0)
    // A quick object URL, not the heavier vector conversion used for the
    // large dialog preview - just enough for a snackbar-sized miniature.
    const thumbnailUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setCurrent({ index: 1, type: file.type, url: thumbnailUrl })
    let uploadedMap = null
    const isPdf = file.type === 'application/pdf'
    try {
      uploadedMap = await uploadMapFile(file, { title, authors, date, note }, { onProgress: setProgress })

      invalidateData()
      try {
        await getData()
      } catch (refreshError) {
        console.error('Map data refresh failed after upload', refreshError)
      }

      setProgress(100)
      openSnackbar(t(isPdf ? 'uploadSuccessPdf' : 'uploadSuccess', { count: 1 }), { severity: 'success' })
    } catch (cause) {
      if (cause?.code === 'offline') {
        setError('needsConnection')
        return null
      }
      console.error(cause)
      setError('uploadError')
    } finally {
      setUploading(false)
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl)
      setCurrent(null)
    }
    return uploadedMap
  }

  return { uploadMap, uploading, progress, current, error, clearError: () => setError(null) }
}

/**
 * The upload's progress and its error; its success is the shared snackbar's.
 */
export default function MapUploadFeedback({ uploading, progress, current, error, clearError }) {
  const { t } = useTranslation('mapsPicker')

  return (
    <>
      <Snackbar open={uploading} autoHide={false}>
        <UploadInfo total={1} progress={progress} current={current} />
      </Snackbar>
      {error && (
        <ErrorAlert open={true} onClose={clearError} header={t('uploadErrorHeader')} dismissLabel={t('dismiss')}>
          <Typography color="text.secondary">{t(error)}</Typography>
        </ErrorAlert>
      )}
    </>
  )
}
