import { useTranslation } from 'react-i18next'
import { Popup } from 'react-map-gl'

export default function Teaser(cave) {
  const { t } = useTranslation('map')
  const { longitude, latitude } = cave.location
  const caveName = cave.name ? cave.name.value : t('caveNameUnknown')
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}>
      {caveName}
    </Popup>
  )
}