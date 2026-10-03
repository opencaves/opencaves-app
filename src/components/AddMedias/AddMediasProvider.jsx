import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileOpen } from 'browser-fs-access'
import UploadMedias from './UploadMedias.jsx'
import { AddMediasContext } from './AddMediasContext.js'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'

export default function AddMediasProvider({ children, caveId }) {
  const [medias, setMedias] = useState([])
  const { t } = useTranslation('mediaPane')

  const pickerOpts = {
    description: t('images'),
    mimeTypes: ACCEPTED_MIME_TYPES,
    extensions: ACCEPTED_EXTENSIONS,
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
      <UploadMedias medias={medias} caveId={caveId} />
    </AddMediasContext.Provider>
  )
}
