import { useEffect, useRef, useState } from 'react'
import { fileOpen, supported } from 'browser-fs-access'
import { acceptedExtensions, acceptedMimeTypes } from '@/config/mediaPane'

export default function AddMediaSm() {
  const inputRef = useRef()
  const [files, setFiles] = useState([])

  useEffect(() => {
    const pickerOpts = {
      description: 'awef',
      mimeTypes: acceptedMimeTypes,
      extensions: acceptedExtensions,
      multiple: true,
    }

    async function getTheFiles() {
      const files = await fileOpen(pickerOpts)
      console.log('files: %o', files)
    }

    getTheFiles()
  }, [])
}