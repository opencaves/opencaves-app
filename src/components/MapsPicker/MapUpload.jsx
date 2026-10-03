import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { Typography } from '@mui/material'
import { ErrorAlert } from '@/components/Alert.jsx'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import { UploadInfo } from '@/components/AddMedias/UploadMedias.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { storage } from '@/config/firebase.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'

const mapsModel = createCollectionModel('maps')

// A map's title always comes from the person uploading it (see MapUploadDetailsFields)
// rather than being guessed from the file, so every map has a name the person
// who added it actually chose.
export function useMapUpload() {
  const { t } = useTranslation('mapsPicker')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(null)
  const [error, setError] = useState(null)
  const [openSnackbar] = useSnackbar()

  async function uploadMap(file, { title, authors = [], date, note } = {}) {
    if (!file) return null
    setError(null)
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('invalidMapFile')
      return null
    }

    setUploading(true)
    setProgress(0)
    // A quick object URL, not the heavier vector conversion used for the
    // large dialog preview - just enough for a snackbar-sized miniature.
    const thumbnailUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setCurrent({ index: 1, type: file.type, url: thumbnailUrl })
    let uploadedMap = null
    try {
      const id = pushId()
      const isPdf = file.type === 'application/pdf'
      const storageRef = ref(storage, isPdf ? `maps/original-pdf/${id}` : `maps/${id}`)
      const task = uploadBytesResumable(storageRef, file)
      await new Promise((resolve, reject) => {
        task.on('state_changed', (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), reject, resolve)
      })

      const url = await getDownloadURL(storageRef)
      const map = { name: title, url, contentType: file.type, authors: authors.length > 0 ? authors : undefined, date: date || undefined, note: note || undefined }
      await mapsModel.save(id, map)
      uploadedMap = { id, ...map }

      invalidateData()
      try {
        await getData()
      } catch (refreshError) {
        console.error('Map data refresh failed after upload', refreshError)
      }

      setProgress(100)
      openSnackbar(t(isPdf ? 'uploadSuccessPdf' : 'uploadSuccess', { count: 1 }), { severity: 'success' })
    } catch (cause) {
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

// The upload's progress and its error; its success is the shared snackbar's.
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
