import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { formSectionHeadingProps } from '@/components/formSectionHeading.js'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'

// The section's own heading, wherever a field draws it (formSectionHeadingProps:
// a class ending in --section-title).
const SECTION_TITLE = '[class*="--section-title"]'

/**
 * A section of an edit form: its fields on a card of the dashboard's opaque,
 * bordered surface ({@link DASHBOARD_SURFACE_SX}), standing out on the dashboard
 * pages' translucent page (and as a bordered card on an opaque one).
 * Its heading shows above the card, not on it: the heading the section's
 * field draws stays in place for screen readers and labelling, hidden from
 * sight, and its text is repeated above (hidden from screen readers, so it's
 * read once).
 */
export default function FormSection({ children, sx, ...props }) {
  const cardRef = useRef(null)
  const [title, setTitle] = useState('')

  // After every render: a field's heading can change (language, a new name).
  useLayoutEffect(() => {
    const text = cardRef.current?.querySelector(SECTION_TITLE)?.textContent.trim() || ''
    if (text !== title) setTitle(text)
  })

  const { sx: headingSx, ...headingProps } = formSectionHeadingProps('oc-form-section--title')
  return (
    <Box component="section" className="oc-form-section" {...props}>
      {title && (
        <Typography {...headingProps} component="div" aria-hidden="true" sx={{ ...headingSx, mb: 1.5, ml: 0.5 }}>
          {title}
        </Typography>
      )}
      <Box
        ref={cardRef}
        className="oc-form-section--card"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: { xs: 2, sm: 3 },
          ...DASHBOARD_SURFACE_SX,
          // The field's own heading, out of sight but kept.
          [`& ${SECTION_TITLE}:not(.oc-form-section--title)`]: { position: 'absolute !important', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', m: '0 !important', p: '0 !important', border: '0 !important', whiteSpace: 'nowrap' },
          ...sx,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
