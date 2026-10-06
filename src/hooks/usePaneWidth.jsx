import { useMediaQuery } from '@mui/material'
import { COMPACT_LANDSCAPE_QUERY, GALLERY_PANE_WIDTH_COMPACT, PANE_WIDTH } from '@/config/app'
import { useSmall } from './useSmall'

// The galleries' list pane (MediaPane, MapPane): the whole width on phones,
// a narrower column on a phone held sideways, PANE_WIDTH otherwise.
export default function usePaneWidth() {
  const isSmall = useSmall()
  const isCompactLandscape = useMediaQuery(COMPACT_LANDSCAPE_QUERY)

  if (isSmall) return window.innerWidth
  return isCompactLandscape ? GALLERY_PANE_WIDTH_COMPACT : PANE_WIDTH
}
