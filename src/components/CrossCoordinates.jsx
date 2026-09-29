import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import { COORDINATE_DECIMALS } from '@/config/map.js'

// The live coordinates under a "Place on map" cross (CoordinatesMapPreview,
// PlaceOnMapOverlay) - what Confirm would store - as plain text centered
// under the cross: white with a dark outline, like the cross, to stay
// readable over any imagery. `center` is { latitude, longitude } or null; `sx`
// positions its top edge and horizontal center (see CROSS_COORDINATES_OFFSET).

// From the cross's center down to the text's top edge: just outside the 48px
// cross (its arms reach 24px from the center).
export const CROSS_COORDINATES_OFFSET = 26

export default function CrossCoordinates({ center, sx }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  if (!center) return null

  return (
    <Box
      className="oc-cross-coordinates"
      // Announced as it settles, not on every frame of a pan (polite).
      aria-live="polite"
      aria-label={`${t('latitude')} ${center.latitude.toFixed(COORDINATE_DECIMALS)}, ${t('longitude')} ${center.longitude.toFixed(COORDINATE_DECIMALS)}`}
      sx={[
        {
          transform: 'translateX(-50%)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textShadow: '0 0 2px rgba(0, 0, 0, 0.9), 0 0 4px rgba(0, 0, 0, 0.7)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {center.latitude.toFixed(COORDINATE_DECIMALS)}, {center.longitude.toFixed(COORDINATE_DECIMALS)}
    </Box>
  )
}
