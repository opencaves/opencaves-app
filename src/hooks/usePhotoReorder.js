import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { savePhotoOrder } from '@/models/CaveAsset.js'
import { useCaveData } from '@/hooks/useCaveData.js'
import { useReorder } from '@/hooks/useReorder.js'

/**
 * A cave's photos as editors reorder them ({@link useReorder}): saved as the
 * cave's order ({@link savePhotoOrder}), the first one becoming the cover -
 * which the confirmation says.
 *
 * @param {string} caveId
 * @param {{docs: import('firebase/firestore').QueryDocumentSnapshot[]} | undefined} list - The cave's photos, in
 *   their order (useCaveAssetsList's).
 * @returns {[string[], (ids: string[]) => Promise<void>]} The photos' ids in the order to show, and the drop's handler.
 */
export function usePhotoReorder(caveId, list) {
  const { t } = useTranslation('reorder')
  const name = useCaveData().caves.find((cave) => cave.id === caveId)?.name?.value || ''
  const ids = useMemo(() => list?.docs.map((doc) => doc.id) || [], [list])
  const coverId = list?.docs.find((doc) => doc.get('isCover'))?.id
  return useReorder(ids, (next) => savePhotoOrder(caveId, next, coverId), {
    name,
    savedMessage: (next) => (next[0] !== ids[0] ? t('savedCover') : t('saved')),
  })
}
