import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

const fetcher = (...args) => fetch(...args).then(res => res.json()).then(data => {
  if (data.status === 'OK') {
    for (const resultType of resultTypes) {
      const result = data.results.find(address => address.types.includes(resultType))
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
  // const [status, setStatus] = useState(props.status)
  const { data, error, isLoading } = useSWR(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.REACT_APP_GOOGLE_GEOCODING_API_KEY}&language=${i18n.resolvedLanguage}&result_type=${resultTypes.join('|')}`, fetcher)

  if (error) {
    return (
      <span>{t('addressLoadingError', { errMessage: error.message })}</span>
    )
  }

  if (isLoading) {
    return <span>{t('addressLoading')}</span>
  }
  // render data
  if (data) {
    return (
      <span>{data.formatted_address}</span>
    )
  }

  return <span>{t('addressNotAvailable')}</span>
}