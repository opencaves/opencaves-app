import { createContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileOpen } from 'browser-fs-access'
import UploadMedias from './UploadMedias'
import { acceptedExtensions, acceptedMimeTypes } from '@/config/mediaPane'

export const AddMediasContext = createContext(null)

export default function AddMediasProvider({ children }) {
  const [medias, setMedias] = useState([])
  const { t } = useTranslation('mediaPane')

  const pickerOpts = {
    description: t('images'),
    mimeTypes: acceptedMimeTypes,
    extensions: acceptedExtensions,
    multiple: true,
  }

  async function promptForMedias() {
    try {
      const files = await fileOpen(pickerOpts)

      if (files.length > 0) {
        setMedias(files)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <AddMediasContext.Provider value={{ promptForMedias }}>
      {children}
      <UploadMedias medias={medias} />
    </AddMediasContext.Provider >
  )
}