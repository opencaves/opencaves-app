import { Box, SvgIcon } from '@mui/material'
import PinIcon from '@/images/map/pin.svg?react'

/**
 * A map pin with a glyph in its circular head, used for special points
 * that aren't the cave's own sistema-colored location marker. pin.svg's
 * viewBox is 0 0 20 28.15:
 * a circular head at the top tapering to a point at the bottom, so the
 * badge's visual center needs to sit well above the halfway mark of the
 * full icon's bounding box to land in that head, not straddle the taper.
 *
 * @param {object} props
 * @param {number} [props.size=20] - Its width, in px.
 * @param {React.ElementType} [props.overlay] - The glyph.
 * @param {string} [props.color='white'] - The pin's.
 * @param {string} [props.overlayColor='#111827'] - The glyph's.
 */
export default function PinBadgeIcon({ size = 20, overlay: Overlay, color = 'white', overlayColor = '#111827' }) {
  return (
    <Box className="oc-pin-badge-icon" sx={{ position: 'relative', width: size, height: size }}>
      <SvgIcon component={PinIcon} inheritViewBox htmlColor={color} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', color, '& > g': { display: 'none' } }} />
      {Overlay && <Overlay sx={{ position: 'absolute', top: '48.5%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: size * 0.55, color: overlayColor, lineHeight: 1 }} />}
    </Box>
  )
}
