import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
import { useFillHeight } from './useFillHeight.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'

// Fields as rendered by the forms' filled TextFields: 56px tall, rounded top.
const fieldSx = { height: 56, borderRadius: '4px 4px 0 0', transform: 'none' }

/**
 * Stand-in for an edit form while its data loads, laid out like the real
 * forms - its header (back button and title), fields on the page, then its
 * sections, each on an opaque card with its heading above it (FormSection),
 * then the Cancel / Save buttons - instead of a bare "Loading…". Screen
 * readers get "Loading…" once (a status), not the shapes.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 * @param {boolean} [props.header=true] - Include the page header (false when the page already shows it)
 * @param {Array} [props.lead=[]] - Field widths on the page itself, before the cards (a cave's name)
 * @param {object[]} [props.sections] - One card each: { title, fields }, title whether it has a
 *   heading above it, fields their widths, or { width, height, helper, kind }
 *   (see Fields), e.g. [{ title: true, fields: ['100%'] }]
 * @param {boolean|'inside'} [props.actions=false] - The form's Cancel / Save buttons, right-aligned below the cards
 *   (inside the last card with actions: 'inside', as the short forms have)
 * @param {boolean} [props.fill=true] - Reach down to the bottom of the page, with more sections than the
 *   form needs (clipped) - for the long forms, taller than a screen
 */
export default function FormSkeleton({ header = true, lead = [], sections = DEFAULT_SECTIONS, actions = false, fill = true, className, sx }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref, fill)
  const allSections = fill ? [...sections, ...FILLER_SECTIONS] : sections
  const actionsRow = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
      {/* Cancel (a text button), Save (filled). */}
      <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 56 }} />
      <Skeleton variant="rounded" sx={{ width: 64, height: 40, borderRadius: 5 }} />
    </Box>
  )

  return (
    <Box ref={ref} className={['oc-form-skeleton', className].filter(Boolean).join(' ')} aria-busy="true" sx={[{ display: 'flex', flexDirection: 'column', gap: 3 }, fill && { height: height ?? '100vh', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" role="status" sx={visuallyHidden}>
        {t('loading')}
      </Box>
      {header && (
        <Box aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" sx={{ fontSize: '1.5rem', width: 'min(60%, 320px)' }} />
        </Box>
      )}
      {lead.length > 0 && <Fields aria-hidden="true" fields={lead} />}
      {allSections.map(({ title, fields }, index) => (
        <Box key={index} aria-hidden="true">
          {title && <Skeleton variant="text" sx={{ fontSize: '1.25rem', width: [160, 120, 190, 140][index % 4], mb: 1.5, ml: 0.5 }} />}
          <Box sx={{ ...DASHBOARD_SURFACE_SX, display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, sm: 3 } }}>
            <Fields fields={fields} />
            {actions === 'inside' && index === allSections.length - 1 && actionsRow}
          </Box>
        </Box>
      ))}
      {actions === true && <Box aria-hidden="true">{actionsRow}</Box>}
    </Box>
  )
}

// A field, by kind: a TextField (its width, a hint line under it with
// helper), an "add" button (button), a Markdown field (markdown: its label,
// toolbar, text area and hint), or tabs over their panel (tabs).
function Fields({ fields, ...props }) {
  return (
    <Box {...props} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {fields.map((field, i) => {
        const { width = '100%', height, helper, kind } = typeof field === 'string' ? { width: field } : field
        const box = { flex: `1 1 ${width}`, maxWidth: width, minWidth: 120 }
        if (kind === 'button') return <Skeleton key={i} variant="rounded" sx={{ width: 170, height: 32, borderRadius: 4 }} />
        if (kind === 'markdown') {
          return (
            <Box key={i} sx={box}>
              <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 90 }} />
              <Skeleton variant="text" sx={{ fontSize: '1.5rem', width: 'min(100%, 300px)', mb: 1 }} />
              <Skeleton variant="rounded" sx={{ height: height ?? 100 }} />
              <Skeleton variant="text" sx={{ fontSize: '0.75rem', width: '70%' }} />
            </Box>
          )
        }
        if (kind === 'tabs') {
          return (
            <Box key={i} sx={box}>
              <Skeleton variant="text" sx={{ fontSize: '1.5rem', width: 'min(100%, 260px)', mb: 2 }} />
              <Skeleton variant="rounded" sx={{ height: height ?? 120 }} />
            </Box>
          )
        }
        return (
          <Box key={i} sx={box}>
            <Skeleton variant="rectangular" sx={[fieldSx, height && { height }]} />
            {helper && <Skeleton variant="text" sx={{ fontSize: '0.75rem', width: '75%', mx: 1.5 }} />}
          </Box>
        )
      })}
    </Box>
  )
}

const DEFAULT_SECTIONS = [{ title: false, fields: ['100%'] }, { title: true, fields: ['calc(50% - 8px)', 'calc(50% - 8px)'] }, { title: true, fields: ['100%', '100%'] }, { title: true, fields: ['100%'] }]
// Appended after the page's own sections (fill) so the sketch always
// reaches the bottom of even a tall screen.
const FILLER_SECTIONS = Array.from({ length: 6 }, () => ({ title: true, fields: ['100%', '100%'] }))

// Read by screen readers, not drawn.
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
