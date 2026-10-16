import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Typography } from '@mui/material'
import { ErrorAlert } from '@/components/Alert.jsx'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import { UploadInfo } from '@/components/AddMedias/UploadMedias.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { loadFirebase } from '@/utils/loadFirebase.js'
import mapsModel from '@/models/MapModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { assertOnline } from '@/utils/assertOnline.js'
import { addPendingUpload } from '@/services/offline/pendingUploads.js'
import { track } from '@/utils/track.js'
import { sha256Hex } from '@/utils/fileHash.js'
import { isTrashed } from '@/utils/trash.js'
import DuplicateMapDialog from './DuplicateMapDialog.jsx'

// The file's SHA-256 (a map's contentHash), or null when the browser can't
// tell: the upload goes on without the check (the server still makes it).
async function contentHashOf(file) {
  try {
    return await sha256Hex(file)
  } catch (error) {
    console.error(error)
    return null
  }
}

/**
 * The maps already on OpenCaves with this file (the same contentHash), not in
 * the trash.
 *
 * @param {string} contentHash
 * @returns {Promise<CaveMap[]>}
 */
export async function findIdenticalMaps(contentHash) {
  const { db, collection, getDocs, query, where } = await loadFirebase()
  const snapshot = await getDocs(query(collection(db, mapsModel.collectionName), where('contentHash', '==', contentHash)))
  return snapshot.docs.map((d) => /** @type {CaveMap} */ ({ id: d.id, ...d.data() })).filter((map) => !isTrashed(map))
}

/**
 * A map file sent to Storage and its record made.
 *
 * @param {File} file
 * @param {{title?: string, authors?: string[], date?: string, note?: string}} [details]
 * @param {object} [options]
 * @param {string} [options.id] - Its record's id - a waiting upload's reserved one (a new push id by default).
 * @param {(percent: number) => void} [options.onProgress] - Its percent sent.
 * @param {string|null} [options.contentHash] - The file's SHA-256 if already worked out (else worked out here), saved
 *   with the map: the server's exact-duplicate check (functions/js/tasks/mapTasks.js).
 * @returns {Promise<CaveMap>} The map ({ id, ...record }).
 * @throws {Error} As the upload does (offline: code 'offline').
 */
export async function uploadMapFile(file, { title, authors = [], date, note } = {}, { id = pushId(), onProgress, contentHash } = {}) {
  assertOnline()
  if (contentHash === undefined) contentHash = await contentHashOf(file)
  const isPdf = file.type === 'application/pdf'
  const { storage, ref, uploadBytesResumable, getDownloadURL } = await (await loadFirebase()).getStorageService()
  const storageRef = ref(storage, isPdf ? `maps/original-pdf/${id}` : `maps/${id}`)
  const task = uploadBytesResumable(storageRef, file)
  await new Promise((resolve, reject) => {
    task.on('state_changed', (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), reject, resolve)
  })
  const url = await getDownloadURL(storageRef)
  const map = { name: title, url, contentType: file.type, authors: authors.length > 0 ? authors : undefined, date: date || undefined, note: note || undefined, contentHash: contentHash || undefined }
  await mapsModel.save(id, map)
  return { id, ...map }
}

/**
 * A map's title always comes from the person uploading it (see MapUploadDetailsFields)
 * rather than being guessed from the file, so every map has a name the person
 * who added it actually chose. A file already on OpenCaves (the same
 * contentHash, {@link findIdenticalMaps}) is asked about first
 * (DuplicateMapDialog, shown by {@link MapUploadFeedback}): its existing map
 * attached instead - uploadMap then gives { id, existing: true, ...map }, which
 * the caller adds to the system as it would the new one - or uploaded anyway
 * (the server makes it an admin task, exactDuplicate).
 *
 * @returns {{uploadMap: Function, uploading: boolean, progress: number, current: *, error: *, clearError: () => void, duplicate: {file: File, maps: CaveMap[]}|null, answerDuplicate: (answer: 'attach'|'upload'|null, map?: CaveMap) => void}}
 */
export function useMapUpload() {
  const { t } = useTranslation('mapsPicker')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(null)
  const [error, setError] = useState(null)
  // The identical maps found, waiting for the uploader's answer.
  const [duplicate, setDuplicate] = useState(null)
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
    track('add_media', { content_type: 'map', media_count: 1, sistema_id: attachToSistemaId || undefined })

    if (!navigator.onLine) {
      const id = pushId()
      try {
        await addPendingUpload({ id, kind: 'map', uid: (await loadFirebase()).auth.currentUser?.uid ?? null, file, name: file.name, details: { title, authors, date, note }, sistemaId: attachToSistemaId })
        openSnackbar(tOffline('pending.mapSaved', { name: title }), { severity: 'success' })
        return { id, pending: true, name: title, contentType: file.type }
      } catch (cause) {
        console.error(cause)
        setError('uploadError')
        return null
      }
    }

    const contentHash = await contentHashOf(file)
    if (contentHash) {
      let identical = []
      try {
        identical = await findIdenticalMaps(contentHash)
      } catch (cause) {
        // Not checked (offline since...): the upload goes on, the server checks.
        console.error(cause)
      }
      if (identical.length > 0) {
        const answer = await new Promise((resolve) => setDuplicate({ file, maps: identical, resolve }))
        setDuplicate(null)
        if (!answer) return null
        if (answer.choice === 'attach') {
          openSnackbar(t('duplicate.attached', { name: answer.map.name || '' }), { severity: 'success' })
          return { ...answer.map, existing: true }
        }
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
      uploadedMap = await uploadMapFile(file, { title, authors, date, note }, { onProgress: setProgress, contentHash })

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

  // The uploader's answer: attach `map` (one of the identical maps), upload
  // anyway, or null (cancelled: nothing is added).
  function answerDuplicate(choice, map) {
    duplicate?.resolve(choice ? { choice, map } : null)
  }

  return { uploadMap, uploading, progress, current, error, clearError: () => setError(null), duplicate, answerDuplicate }
}

/**
 * The upload's progress and its error, and the question about a file already
 * on OpenCaves; its success is the shared snackbar's.
 *
 * @param {object} props
 * @param {boolean} props.uploading
 * @param {number} props.progress
 * @param {*} props.current
 * @param {*} props.error
 * @param {() => void} props.clearError
 * @param {{file: File, maps: CaveMap[]}|null} [props.duplicate] - The identical maps found ({@link useMapUpload}).
 * @param {(answer: 'attach'|'upload'|null, map?: CaveMap) => void} [props.answerDuplicate]
 */
export default function MapUploadFeedback({ uploading, progress, current, error, clearError, duplicate = null, answerDuplicate }) {
  const { t } = useTranslation('mapsPicker')

  return (
    <>
      <DuplicateMapDialog duplicate={duplicate} onAnswer={answerDuplicate} />
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
