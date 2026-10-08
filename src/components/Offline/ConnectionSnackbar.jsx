import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CloudDoneRounded from '@mui/icons-material/CloudDoneRounded'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useOnline } from '@/hooks/useOnline.jsx'
import { pendingWriteCount } from '@/services/offline/pendingWrites.js'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'

// How long a change must last to be told: a network dropping for a moment
// (a flaky signal) says nothing.
const SETTLE_MS = 2000

// Says when the connection goes or comes back, with a cloud crossed out or
// checked - on a change only, not when the app starts; back online, that the
// changes made offline are syncing, when there are some.
export default function ConnectionSnackbar() {
  const online = useOnline()
  const announced = useRef(online)
  const [openSnackbar] = useSnackbar()
  // Without saved caves (a visitor), not told they're still there.
  const { savedCaveIds } = useSavedCaves()
  const hasSaved = savedCaveIds.length > 0
  const { t } = useTranslation('offline', { keyPrefix: 'connection' })

  useEffect(() => {
    if (online === announced.current) return undefined
    // Counted now, before they've had time to sync.
    const syncing = online && pendingWriteCount() > 0
    const timer = setTimeout(() => {
      announced.current = online
      openSnackbar(online ? t(syncing ? 'onlineSyncing' : 'online') : t(hasSaved ? 'offline' : 'offlineNoSaved'), online ? { severity: 'success', icon: <CloudDoneRounded /> } : { icon: <CloudOffRounded /> })
    }, SETTLE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  return null
}
