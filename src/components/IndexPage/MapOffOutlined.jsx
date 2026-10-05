import { useId } from 'react'
import { SvgIcon } from '@mui/material'

// MapOutlined crossed out, in the Material "off" icons' style (DirectionsOff,
// LocationOff): their slash - a 2px bar from the top left to the bottom right
// - with the map cut away along both sides of it. Material has no map-off icon.
const MAP = 'm20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M10 5.47l4 1.4v11.66l-4-1.4zm-5 .99 3-1.01v11.7l-3 1.16zm14 11.08-3 1.01V6.86l3-1.16z'
const SLASH = 'M2.81 2.81 1.39 4.22l18.39 18.39 1.41-1.41z'

export default function MapOffOutlined(props) {
  const mask = `oc-map-off-${useId().replace(/:/g, '')}`
  return (
    <SvgIcon {...props}>
      <mask id={mask}>
        <rect width="24" height="24" fill="#fff" />
        {/* The gap: the slash's band, widened by a pixel on each side. */}
        <path d="M2.1 2.1-.02 4.22l19.8 19.8 2.12-2.12z" fill="#000" />
      </mask>
      <path d={MAP} mask={`url(#${mask})`} />
      <path d={SLASH} />
    </SvgIcon>
  )
}
