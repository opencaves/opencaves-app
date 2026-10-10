import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileOpen } from 'browser-fs-access'
import UploadMedias from './UploadMedias.jsx'
import { AddMediasContext } from './AddMediasContext.js'
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'

/**
 * Lets its children open the file picker to add photos (useAddMedias), and
 * uploads what's picked.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.caveId] - The cave the photos go to (the map's open cave otherwise).
 */
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
      // An array: the picker allows several files (multiple).
      const files = /** @type {import('browser-fs-access').FileWithHandle[]} */ (await fileOpen(pickerOpts))

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
