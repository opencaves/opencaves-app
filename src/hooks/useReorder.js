import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'

// After its save settled, the order dropped shows this long at most if the
// data hasn't caught up (a change made elsewhere meanwhile): the data's then.
const PENDING_MAX_MS = 5000

const sameItems = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

/**
 * A list editors reorder, saved on drop, optimistically: the new order shows
 * at once, until the data shows it too (its write comes back through
 * Firestore's listeners, sometimes in steps - a photo's cover and its cave's
 * order), or the items change (one added or removed). Saved through
 * {@link useSettleWrite} (offline: kept on the device, said so); confirmed
 * by a snackbar, or, refused, the order restored and a snackbar says so.
 *
 * @param {string[]} ids - The items in the data's order.
 * @param {(ids: string[]) => Promise<unknown>} save - Writes the new order.
 * @param {object} [options]
 * @param {string} [options.name] - The record's name, for the offline messages.
 * @param {(ids: string[]) => string} [options.savedMessage] - The confirmation for a new order (default: "Order saved").
 * @returns {[string[], (ids: string[]) => Promise<void>]} The order to show, and the drop's handler.
 */
export function useReorder(ids, save, { name, savedMessage } = {}) {
  const { t } = useTranslation('reorder')
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const [pending, setPending] = useState(/** @type {string[] | null} */ (null))
  const timer = useRef(null)
  const key = ids.join('\n')

  useEffect(() => {
    if (pending && (pending.join('\n') === key || !sameItems(pending, ids))) setPending(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => clearTimeout(timer.current), [])

  async function reorder(next) {
    clearTimeout(timer.current)
    setPending(next)
    try {
      const status = await settleWrite(Promise.resolve().then(() => save(next)), { name })
      if (status === 'saved') openSnackbar(savedMessage ? savedMessage(next) : t('saved'), { severity: 'success' })
      timer.current = setTimeout(() => setPending(null), PENDING_MAX_MS)
    } catch (error) {
      console.error(error)
      setPending(null)
      openSnackbar(t('saveError'), { severity: 'error' })
    }
  }

  return [pending && sameItems(pending, ids) ? pending : ids, reorder]
}
