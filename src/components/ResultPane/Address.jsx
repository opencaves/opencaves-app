import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { toServiceLanguage } from '@/utils/lang.js'
import { useOnline } from '@/hooks/useOnline.jsx'

// The address comes from our caveAddress function, which keeps the Google
// key on the server and only looks up caves' own positions.
const fetcher = (url) =>
  fetch(url).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok && res.status !== 404) throw new Error(data.error || res.statusText)
    return data.address ? { formatted_address: data.address } : null
  })

export default function Address({ caveId, latitude, longitude }) {
  const { t, i18n } = useTranslation('resultPane')
  const online = useOnline()
  // SWR looks the address up again when the connection comes back.
  // The position is only there for the caches: a moved cave gets a new
  // address (the function reads the cave's position itself).
  const { data, error, isLoading } = useSWR(`/api/address/${encodeURIComponent(caveId)}?lang=${toServiceLanguage(i18n.resolvedLanguage)}&at=${latitude},${longitude}`, fetcher)

  if (!online && !data) {
    return <span className="oc-address">{t('addressOffline')}</span>
  }

  if (error) {
    return <span className="oc-address">{t('addressLoadingError', { errMessage: error.message })}</span>
  }

  if (isLoading) {
    return <span className="oc-address">{t('addressLoading')}</span>
  }
  // render data
  if (data) {
    return <span className="oc-address">{data.formatted_address}</span>
  }

  return <span className="oc-address">{t('addressNotAvailable')}</span>
}
