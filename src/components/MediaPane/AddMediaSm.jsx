import { useEffect, useRef, useState } from 'react'
import { fileOpen, supported } from 'browser-fs-access'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'

export default function AddMediaSm() {
  const inputRef = useRef()
  const [files, setFiles] = useState([])

  useEffect(() => {
    const pickerOpts = {
      description: 'awef',
      mimeTypes: ACCEPTED_MIME_TYPES,
      extensions: ACCEPTED_EXTENSIONS,
      multiple: true,
    }

    async function getTheFiles() {
      await fileOpen(pickerOpts)
    }

    getTheFiles()
  }, [])
}