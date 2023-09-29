import { fileOpen } from 'browser-fs-access'
import { acceptedExtensions, acceptedMimeTypes } from '@/config/mediaPane'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function useGetMedias() {
  const { t } = useTranslation('mediaPane')
  const [medias, setMedias] = useState()

  // async function getMedias() {
  const getMedias = useCallback(async () => {
    const pickerOpts = {
      description: t('images'),
      mimeTypes: acceptedMimeTypes,
      extensions: acceptedExtensions,
      multiple: true,
    }

    const files = await fileOpen(pickerOpts)
    console.log('ici je setMedias(%o)', files)
    setMedias(files)
  }, [])

  return [medias, getMedias]
}