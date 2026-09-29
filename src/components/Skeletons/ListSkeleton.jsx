import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
import { useFillHeight } from './useFillHeight.jsx'

// A row's height (py 1.5 + a title and a secondary line), for how many fit.
const ROW_HEIGHT = 70
// A group heading's height (ListSubheader's 48px line).
const HEADING_HEIGHT = 48
// Rows per group, cycled, so groups don't all look alike.
const GROUP_SIZES = [4, 2, 5, 3]

// Stand-in for a list while its data loads - rows shaped like the real ones
// (a leading icon or color square, a title and a secondary line, divided) -
// instead of a bare "Loading…". Screen readers get "Loading…" once (a
// status), not the shapes.
// - rows: how many placeholder rows (at least - see fill)
// - fill: reach down to the bottom of the page (a whole page loading),
//   with as many rows as that takes; false for a list within a loaded page
// - leading: 'square' (color swatch), 'circle' (icon/avatar) or null
// - secondary: whether rows have a second, smaller line
// - count / search: the list's own header, when it has one - its item count
//   line and its (small, outlined, rounded) search field
// - grouped: rows under group headings (a list grouped by area, with
//   ListSubheaders)
export default function ListSkeleton({ rows = 6, leading = 'square', secondary = true, count = false, search = false, grouped = false, fill = true, className, sx }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref, fill)
  const items = layoutItems({ rows, grouped, height })

  return (
    <Box ref={ref} className={['oc-list-skeleton', className].filter(Boolean).join(' ')} aria-busy="true" sx={[fill && { height: height ?? '100vh', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" role="status" sx={visuallyHidden}>
        {t('loading')}
      </Box>
      {count && <Skeleton aria-hidden="true" variant="text" sx={{ fontSize: '0.875rem', width: 90, mb: search ? 2 : 1 }} />}
      {search && <Skeleton aria-hidden="true" variant="rounded" sx={(theme) => ({ height: 40, borderRadius: `${theme.shape.borderRadius * 4}px`, mb: 2 })} />}
      {items.map(({ heading, index }) =>
        heading ? (
          <Box key={`heading-${index}`} aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', height: HEADING_HEIGHT, px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: [140, 110, 170, 125][index % 4] }} />
          </Box>
        ) : (
          <Box key={index} aria-hidden="true" sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            {leading === 'square' && <Skeleton variant="rounded" width={24} height={24} />}
            {leading === 'circle' && <Skeleton variant="circular" width={32} height={32} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Varied widths, so it doesn't read as a grid of bars. */}
              <Skeleton variant="text" sx={{ fontSize: '1rem', width: `${[55, 40, 65, 48, 35, 60][index % 6]}%` }} />
              {secondary && <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: `${[30, 25, 35, 22, 28, 32][index % 6]}%` }} />}
            </Box>
          </Box>
        ),
      )}
    </Box>
  )
}

// The rows (and, when grouped, the headings before each group) - at least
// `rows` rows, and enough to fill `height` once it's measured.
function layoutItems({ rows, grouped, height }) {
  const items = []
  let used = 0
  let rowIndex = 0
  let groupIndex = 0
  let leftInGroup = 0
  while (rowIndex < rows || (height && used < height)) {
    if (grouped && leftInGroup === 0) {
      items.push({ heading: true, index: groupIndex })
      used += HEADING_HEIGHT
      leftInGroup = GROUP_SIZES[groupIndex % GROUP_SIZES.length]
      groupIndex++
    }
    items.push({ heading: false, index: rowIndex })
    used += ROW_HEIGHT
    rowIndex++
    leftInGroup--
  }
  return items
}

// Read by screen readers, not drawn.
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
