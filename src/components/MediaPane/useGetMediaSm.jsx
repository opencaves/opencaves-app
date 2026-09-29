import { useCallback, useEffect, useRef, useState } from 'react'
import { fileOpen } from 'browser-fs-access'
import { useTranslation } from 'react-i18next'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'

export default function useGetMedias() {
  const { t } = useTranslation('mediaPane')
  const [medias, setMedias] = useState()

  // async function getMedias() {
  const getMedias = useCallback(async () => {
    const pickerOpts = {
      description: t('images'),
      mimeTypes: ACCEPTED_MIME_TYPES,
      extensions: ACCEPTED_EXTENSIONS,
      multiple: true,
    }

    const files = await fileOpen(pickerOpts)
    setMedias(files)
  }, [])

  return [medias, getMedias]
}