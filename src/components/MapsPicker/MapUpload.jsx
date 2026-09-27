import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { Alert, Typography } from '@mui/material'
import { ErrorAlert } from '@/components/Alert.jsx'
import Snackbar from '@/components/Snackbar/Snackbar.jsx'
import { SnackbarContent, UploadInfo } from '@/components/AddMedias/UploadMedias.jsx'
import { uploadCompleteHideDuration } from '@/config/mediaPane.js'
import { storage } from '@/config/firebase.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'

const mapsModel = createCollectionModel('maps')

async function getMapName(file) {
  const filename = file.name.replace(/\.[^.]+$/, '')
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      return pdf.getTitle()?.trim() || filename
    } catch (error) {
      console.warn('Could not read PDF map title', error)
      return filename
    }
  }
  if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) return filename

  const document = new DOMParser().parseFromString(await file.text(), 'image/svg+xml')
  return document.querySelector('svg > title')?.textContent?.trim() || filename
}

export function useMapUpload() {
  const { t } = useTranslation('mapsPicker')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function uploadMaps(files, details = {}) {
    const selectedFiles = Array.from(files)
    if (selectedFiles.length === 0) return []
    setError(null)
    setSuccess(null)
    if (selectedFiles.some((file) => !file.type.startsWith('image/') && file.type !== 'application/pdf')) {
      setError('invalidMapFile')
      return []
    }

    setUploading(true)
    setProgress(0)
    setTotal(selectedFiles.length)
    const totalBytes = Math.max(
      1,
      selectedFiles.reduce((total, file) => total + file.size, 0),
    )
    let completedBytes = 0
    let previewUrl = null
    const uploadedMaps = []
    let failed = false
    try {
      for (const [index, file] of selectedFiles.entries()) {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        setCurrent({ index: index + 1, type: file.type, url: previewUrl })
        const id = pushId()
        const isPdf = file.type === 'application/pdf'
        const storageRef = ref(storage, isPdf ? `maps/original-pdf/${id}` : `maps/${id}`)
        const task = uploadBytesResumable(storageRef, file)
        await new Promise((resolve, reject) => {
          task.on('state_changed', (snapshot) => setProgress(Math.round(((completedBytes + snapshot.bytesTransferred) / totalBytes) * 100)), reject, resolve)
        })

        completedBytes += file.size
        const url = await getDownloadURL(storageRef)
        const map = { name: await getMapName(file), url, contentType: file.type, ...details }
        await mapsModel.save(id, map)
        uploadedMaps.push({ id, ...map })
      }
    } catch (cause) {
      console.error(cause)
      failed = true
      setError('uploadError')
    } finally {
      if (uploadedMaps.length > 0) {
        invalidateData()
        try {
          await getData()
        } catch (refreshError) {
          console.error('Map data refresh failed after upload', refreshError)
        }
      }
      if (!failed) {
        setProgress(100)
        setSuccess(t(selectedFiles.some((file) => file.type === 'application/pdf') ? 'uploadSuccessPdf' : 'uploadSuccess', { count: uploadedMaps.length }))
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setUploading(false)
    }
    return uploadedMaps
  }

  return { uploadMaps, uploading, progress, current, total, error, success, clearError: () => setError(null) }
}

export default function MapUploadFeedback({ uploading, progress, current, total, error, success, clearError }) {
  const { t } = useTranslation('mapsPicker')

  return (
    <>
      <Snackbar open={uploading} autoHide={false}>
        <UploadInfo total={total} progress={progress} current={current} />
      </Snackbar>
      {error && (
        <ErrorAlert open={true} onClose={clearError} header={t('uploadErrorHeader')} dismissLabel={t('dismiss')}>
          <Typography color="text.secondary">{t(error)}</Typography>
        </ErrorAlert>
      )}
      {success && (
        <Snackbar open={true} autoHideDuration={uploadCompleteHideDuration}>
          <SnackbarContent sx={{ flexGrow: 0, minWidth: 'unset' }}>
            <Alert>{success}</Alert>
          </SnackbarContent>
        </Snackbar>
      )}
    </>
  )
}
