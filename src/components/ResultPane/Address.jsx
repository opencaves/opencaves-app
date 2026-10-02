import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { toServiceLanguage } from '@/utils/lang.jsx'
import { useOnline } from '@/hooks/useOnline.jsx'

const fetcher = (...args) =>
  fetch(...args)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === 'OK') {
        for (const resultType of resultTypes) {
          const result = data.results.find((address) => address.types.includes(resultType))
          if (result) {
            return result
          }
        }
      }

      if (data.error_message) {
        throw new Error(data.error_message)
      }

      return null
    })

const resultTypes = 'street_address|route|postal_code|natural_feature|park|point_of_interest'.split('|')

export default function Address({ latitude, longitude }) {
  const { t, i18n } = useTranslation('resultPane')
  const online = useOnline()
  // SWR looks the address up again when the connection comes back.
  const { data, error, isLoading } = useSWR(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}&language=${toServiceLanguage(i18n.resolvedLanguage)}&result_type=${resultTypes.join('|')}`, fetcher)

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
