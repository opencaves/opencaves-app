import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Divider, Skeleton } from '@mui/material'
import { useFillHeight } from './useFillHeight.jsx'

// Fields as rendered by the forms' filled TextFields: 56px tall, rounded top.
const fieldSx = { height: 56, borderRadius: '4px 4px 0 0', transform: 'none' }

// Stand-in for an edit form while its data loads - its header (back button
// and title) and sections of fields, laid out like the real forms (dividers,
// section headings with their accent bar) - instead of a bare "Loading…".
// Screen readers get "Loading…" once (a status), not the shapes.
// - header: include the page header (false when the page already shows it)
// - sections: field widths per section, e.g. [['100%'], ['50%', '50%']];
//   each section but the first starts with a heading. It reaches down to
//   the bottom of the page, with more sections than it needs (clipped).
export default function FormSkeleton({ header = true, sections = DEFAULT_SECTIONS, className, sx }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref)
  const allSections = [...sections, ...FILLER_SECTIONS]

  return (
    <Box ref={ref} className={['oc-form-skeleton', className].filter(Boolean).join(' ')} aria-busy="true" sx={[{ display: 'flex', flexDirection: 'column', gap: 2, height: height ?? '100vh', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" role="status" sx={visuallyHidden}>
        {t('loading')}
      </Box>
      {header && (
        <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" sx={{ fontSize: '1.5rem', width: 'min(60%, 320px)' }} />
        </Box>
      )}
      {allSections.map((fields, index) => (
        <Box key={index} aria-hidden="true" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {index > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 3, height: 24, bgcolor: 'secondary.main', opacity: 0.4 }} />
                <Skeleton variant="text" sx={{ fontSize: '1.25rem', width: 160 }} />
              </Box>
            </>
          )}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {fields.map((width, i) => (
              <Skeleton key={i} variant="rectangular" sx={[fieldSx, { flex: `1 1 ${width}`, maxWidth: width, minWidth: 120 }]} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

const DEFAULT_SECTIONS = [['100%'], ['calc(50% - 8px)', 'calc(50% - 8px)'], ['100%', '100%'], ['100%']]
// Appended after the page's own sections so the sketch always reaches the
// bottom of even a tall screen.
const FILLER_SECTIONS = Array.from({ length: 6 }, () => ['100%', '100%'])

// Read by screen readers, not drawn.
const visuallyHidden = { position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
