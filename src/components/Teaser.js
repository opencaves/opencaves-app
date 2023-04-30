import { Popup } from 'react-map-gl'

export default function Teaser(caveData) {
  const { longitude, latitude } = caveData.location
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}>
      {caveData.name}
    </Popup>
  )
}