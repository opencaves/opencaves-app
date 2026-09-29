import { Box } from '@mui/material'

export const CROSS_SIZE = 48

// The "Place on map" cross (CoordinatesMapPreview, PlaceOnMapOverlay):
// centered on the point being placed. Thin white lines with a dark outline
// stay visible over any imagery; the gap at the center keeps the exact spot
// itself uncovered. `sx` positions its center (it's translated by half its
// size).
export default function PlaceCross({ sx }) {
  return (
    <Box
      component="svg"
      className="oc-place-cross"
      aria-hidden="true"
      viewBox="0 0 48 48"
      sx={[{ width: CROSS_SIZE, height: CROSS_SIZE, transform: 'translate(-50%, -50%)', pointerEvents: 'none', overflow: 'visible' }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 2v17M24 29v17M2 24h17M29 24h17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2" fill="#fff" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="1.5" />
    </Box>
  )
}
