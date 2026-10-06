import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

// How long a write may wait for the server before it counts as kept on the
// device: a connection that's there but doesn't answer (a weak signal) is as
// good as none.
const PENDING_AFTER_MS = 5000

// A Firestore write applies on the device at once, but its promise resolves
// only when the server confirms it - offline, when the connection comes back.
// settle(write, { name }) waits for that only while online, and not long:
// - 'saved': the server confirmed it;
// - 'pending': kept on the device, to sync later. Says so ("saved on this
//   device…"), then that it synced, or, refused once back online (the
//   database's rules), that it couldn't be saved - Firestore then undoes it
//   on the device.
// A write refused right away rejects, as before. writes: one promise, or
// several (a form saving more than one record).
export function useSettleWrite() {
  const { t } = useTranslation('app', { keyPrefix: 'snackbar' })
  const [openSnackbar] = useSnackbar()

  return useCallback(
    (writes, { name } = {}) => {
      const write = Array.isArray(writes) ? Promise.all(writes) : writes
      const follow = () => {
        openSnackbar(t('savedOffline', { name }), { severity: 'success' })
        write.then(
          () => openSnackbar(t('synced', { name }), { severity: 'success' }),
          (error) => {
            console.error(error)
            openSnackbar(t('syncError', { name }), { autoHide: false })
          },
        )
        return 'pending'
      }
      if (!navigator.onLine) return Promise.resolve(follow())
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(follow()), PENDING_AFTER_MS)
        write.then(
          () => {
            clearTimeout(timer)
            resolve('saved')
          },
          (error) => {
            clearTimeout(timer)
            reject(error)
          },
        )
      })
    },
    [t, openSnackbar],
  )
}
