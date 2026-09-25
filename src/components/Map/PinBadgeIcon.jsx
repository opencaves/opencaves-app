import { Box, SvgIcon } from '@mui/material'
import PinIcon from '@/images/map/pin.svg?react'

// A white map pin with a small dark glyph badged in its circular head -
// used for "special point" fields (entrance, key) that aren't the cave's
// own sistema-colored location marker. pin.svg's viewBox is 0 0 20 28.15:
// a circular head at the top tapering to a point at the bottom, so the
// badge's visual center needs to sit well above the halfway mark of the
// full icon's bounding box to land in that head, not straddle the taper.
export default function PinBadgeIcon({ size = 20, overlay: Overlay }) {
  return (
    <Box className="oc-pin-badge-icon" sx={{ position: 'relative', width: size, height: size }}>
      <SvgIcon component={PinIcon} inheritViewBox htmlColor="white" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', color: 'white' }} />
      {Overlay && <Overlay sx={{ position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: size * 0.55, color: '#111827', lineHeight: 1 }} />}
    </Box>
  )
}
