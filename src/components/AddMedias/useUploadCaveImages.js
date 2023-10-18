
import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import CaveAsset from '@/models/CaveAsset'
import useLoggedIn from '@/hooks/useLoggedin.js'

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