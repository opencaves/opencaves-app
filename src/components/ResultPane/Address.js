import useSWR from 'swr'
import { useTranslation } from 'react-i18next'

const fetcher = (...args) => fetch(...args).then(res => res.json()).then(data => {
  console.log('.......................... %o', data)
  if (data.status === 'OK') {
    for (const resultType of resultTypes) {
      const result = data.results.find(address => address.types.includes(resultType))
      console.log('type: %s, address: %o', resultType, result)
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
  const { i18n } = useTranslation()
  const { data, error, isLoading } = useSWR(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_GEOCODING_API_KEY}&language=${i18n.resolvedLanguage}&result_type=${resultTypes.join('|')}`, fetcher)
  // const { data, error, isLoading } = useSWR(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?limit=1&access_token=${process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}`, fetcher)

  if (error) return <div>Failed to load: {error.message}</div>
  if (isLoading) return <div>loading...</div>

  // render data
  return data && <div>{data.formatted_address}</div>
}