import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Tooltip } from '@mui/material'
import { FullscreenExitRounded, FullscreenRounded } from '@mui/icons-material'
import OCMap from '@/components/Map/Map.jsx'

// Inline map beside an edit page's CoordinateFields (cave and sistema admin
// pages). Map.jsx's own CSS fills its nearest positioned ancestor with a
// defined height (it's built to fill the whole /map page) - this box supplies
// both so it renders as an inline preview here instead. Dragging the
// CoordinateField pin icons or clicking the map still works via the same
// pickingCoordinateFor/editFieldCoordinates redux state CoordinateField
// itself dispatches to.
//
// Enlarges in place (not a Dialog) so the CoordinateField drag-pin/pick-
// location tools next to it stay reachable and aren't hidden behind a dialog
// backdrop. aspectRatio (not a fixed height) keeps it in proportion as it
// grows to fill the width freed up by the coordinates column shrinking to its
// content width.
export default function CoordinatesMapPreview() {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [expanded, setExpanded] = useState(false)

  return (
    <Box className="oc-coordinates-map-preview" sx={{ position: 'relative', width: '100%', aspectRatio: expanded ? '4 / 3' : '16 / 9', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', transition: (theme) => theme.transitions.create('aspect-ratio') }}>
      <Tooltip title={expanded ? t('shrinkMap') : t('enlargeMap')}>
        <IconButton size="small" aria-label={expanded ? t('shrinkMap') : t('enlargeMap')} onClick={() => setExpanded((v) => !v)} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
          {expanded ? <FullscreenExitRounded fontSize="small" /> : <FullscreenRounded fontSize="small" />}
        </IconButton>
      </Tooltip>
      <OCMap />
    </Box>
  )
}
