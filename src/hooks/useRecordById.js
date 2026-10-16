import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { DOCUMENTS_COLLECTION } from '@/config/collections.js'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { isTrashed } from '@/utils/trash.js'

// A whole record id as pasted: a push id, 20 characters starting with "-".
const PUSH_ID = /^-[A-Za-z0-9_-]{19}$/

/**
 * The survey map, document or photo a whole pasted id names (the site's
 * search, {@link useIndexData} for the caves and systems), read once each
 * (one read per collection, in the background - never while a fragment is
 * typed): each as a search suggestion leading to where it shows - a map to
 * its system's viewer, a document to the Further reading of the cave or
 * system listing it, a photo to its cave's gallery. Those in the trash, and
 * documents not yet ready, are for admins only.
 *
 * @param {string} input - What's typed.
 * @returns {{kind: string, id: string, label: string, secondary: string, to: string}[]} kind: maps, documents or photos.
 */
export function useRecordById(input) {
  const { t } = useTranslation('indexPages', { keyPrefix: 'idSearch' })
  const { data } = useIndexData()
  // The caves as stored: the index's leave out their documents.
  const storeCaves = useSelector((/** @type {RootState} */ state) => state.data.caves)
  const isAdmin = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('admin')
  const id = (input || '').trim()
  const wanted = PUSH_ID.test(id) ? id : null
  const [found, setFound] = useState(/** @type {{id: string, map?: object, document?: object, photo?: object}|null} */ (null))

  useEffect(() => {
    if (!wanted) return undefined
    let active = true
    const read = (collection) => getDoc(doc(db, collection, wanted)).then((snapshot) => (snapshot.exists() ? snapshot : null), () => null)
    Promise.all([read('maps'), read(DOCUMENTS_COLLECTION), read('cavesAssets')]).then(([map, document, photo]) => {
      const shown = (snapshot) => snapshot && (isAdmin || !isTrashed(snapshot)) ? { id: snapshot.id, ...snapshot.data() } : null
      if (active) setFound({ id: wanted, map: shown(map), document: shown(document), photo: shown(photo) })
    })
    return () => {
      active = false
    }
  }, [wanted, isAdmin])

  return useMemo(() => {
    if (!wanted || found?.id !== wanted) return []
    const entries = []
    if (found.map) {
      const sistema = data.sistemas.find((s) => Array.isArray(s.maps) && s.maps.includes(wanted))
      if (sistema?.slug) entries.push({ kind: 'maps', id: `m-${wanted}`, label: found.map.name || t('unnamedMap'), secondary: wanted, to: `/sistemas/${sistema.slug}/maps/${wanted}` })
    }
    if (found.document && (isAdmin || found.document.kind === 'link' || found.document.status === 'ready')) {
      const cave = storeCaves.find((c) => Array.isArray(c.documents) && c.documents.includes(wanted))
      const sistema = cave ? null : data.sistemas.find((s) => Array.isArray(s.documents) && s.documents.includes(wanted))
      const to = cave ? `/caves/${cave.id}#further-reading` : sistema?.slug ? `/sistemas/${sistema.slug}#further-reading` : null
      if (to) entries.push({ kind: 'documents', id: `d-${wanted}`, label: found.document.title || t('untitledDocument'), secondary: wanted, to })
    }
    if (found.photo?.caveId) {
      const cave = data.caves.find((c) => c.id === found.photo.caveId)
      if (cave) entries.push({ kind: 'photos', id: `p-${wanted}`, label: t('photoOf', { name: cave.name || '' }), secondary: wanted, to: `/caves/${cave.id}/photos/${wanted}` })
    }
    return entries
  }, [wanted, found, data, storeCaves, isAdmin, t])
}
