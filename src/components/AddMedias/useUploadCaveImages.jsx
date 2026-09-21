
import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { auth } from '@/config/firebase.js'
import CaveAsset from '@/models/CaveAsset.js'
import useLoggedIn from '@/hooks/useLoggedin.jsx'
import sleep from '@/utils/sleep.js'
import { acceptedMimeTypes } from '@/config/mediaPane.js'

function findWrongMediaTypeFiles(files) {
  return files.filter(file => !acceptedMimeTypes.includes(file.type))
}

async function ensureEditorRole() {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error('You must be signed in to upload media.')
  }

  const maxAttempts = 6
  const delayMs = 500

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await currentUser.getIdToken(true)
    const idTokenResult = await currentUser.getIdTokenResult()
    const roles = idTokenResult.claims.roles

    if (Array.isArray(roles) && roles.includes('editor')) {
      return
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs)
    }
  }

  throw new Error('Your account is missing the editor role required to upload media.')
}

export function useUploadCaveImages() {
  const user = useSelector(state => state.session.user)
  const currentCave = useSelector(state => state.map.currentCave)

  const [current, setCurrent] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [bytesTransferred, setBytesTransferred] = useState(null)
  const [totalBytes, setTotalBytes] = useState(0)
  const isLoggedIn = useLoggedIn()

  function reset() {
    setTotalBytes(0)
    setProgress(null)
    setCurrent(null)
  }

  async function uploadCaveImages(files) {
    // console.log('Start uploading files: ', files)
    try {
      if (files && files.length > 0) {
        if (!isLoggedIn) {
          throw new Error('You must be signed in to upload media.')
        }

        const wrongTypeFiles = findWrongMediaTypeFiles(files)
        if (wrongTypeFiles.length > 0) {
          const fileNames = wrongTypeFiles.map(file => file.name)
          const wrongTypeError = new Error(`Unsupported media type for file(s): ${fileNames.join(', ')}`)
          wrongTypeError.code = 'wrong-media-type'
          wrongTypeError.fileNames = fileNames
          throw wrongTypeError
        }

        await ensureEditorRole()

        setBytesTransferred(Array(files.length).fill(0))
        setTotalBytes(files.reduce((total, file) => total + file.size, 0))
        setDone(false)
        setError(null)

        for (const [i, file] of files.entries()) {
          const index = i + 1
          const url = URL.createObjectURL(file)
          const caveAssetData = {
            caveId: currentCave.id,
          }

          if (isLoggedIn) {
            caveAssetData.userId = user.uid
          }

          setCurrent({ index, url })

          const caveAsset = new CaveAsset(caveAssetData)

          await caveAsset.upload(file, bytesTransferred => {
            // console.log('[%s] %s', file.name, bytesTransferred)
            setTimeout(() => {
              setBytesTransferred(bytes => {
                const newBytes = [...bytes]
                newBytes.splice(i, 1, bytesTransferred)
                return newBytes
              })
            })
          })
        }

        // console.log('Finished uploading')
        setDone({ count: files.length })
      }
    } catch (error) {
      console.error('[uploadCaveImages] error: %o', error)
      setDone()
      setError(error)
      reset()
    }
  }

  useEffect(() => {
    if (totalBytes) {
      const totalBytesTransferred = bytesTransferred.reduce((total, bytes) => total + bytes, 0)
      setProgress(Math.round((totalBytesTransferred / totalBytes) * 100))
    }
  }, [bytesTransferred, totalBytes])

  return { uploadCaveImages, current, progress, done, error }
}