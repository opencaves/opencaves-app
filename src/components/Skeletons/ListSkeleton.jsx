import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
import { useFillHeight } from './useFillHeight.jsx'
import { DASHBOARD_LIST_SX } from '@/components/dashboardSurface.js'

// A row's height (py 1.5 + a title and a secondary line), for how many fit.
const ROW_HEIGHT = 70
// A table row's (one line of body2, py 0.75).
const TABLE_ROW_HEIGHT = 37
// A group heading's height (ListSubheader's 48px line).
const HEADING_HEIGHT = 48
// A group's height on top of its rows, as cards: its title above and the
// gap after it.
const CARD_GROUP_HEIGHT = 64
const GROUP_TITLE_WIDTHS = [140, 110, 170, 125]
// Rows per group, cycled, so groups don't all look alike.
const GROUP_SIZES = [4, 2, 5, 3]

/**
 * Stand-in for a list while its data loads - rows shaped like the real ones
 * (a leading icon or color square, a title and a secondary line, divided) -
 * instead of a bare "Loading…". Screen readers get "Loading…" once (a
 * status), not the shapes.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 * @param {number} [props.rows=6] - How many placeholder rows (at least - see fill)
 * @param {boolean} [props.fill=true] - Reach down to the bottom of the page (a whole page loading),
 *   with as many rows as that takes; false for a list within a loaded page
 * @param {'square'|'circle'|null} [props.leading='square'] - 'square' (color swatch), 'circle' (icon/avatar) or null
 * @param {boolean} [props.secondary=true] - Whether rows have a second, smaller line
 * @param {boolean} [props.count=false] - With search: the list's own header, when it has one - its item count
 *   line
 * @param {boolean} [props.search=false] - With count: the list's own header - its (small, outlined, rounded) search field
 * @param {boolean} [props.grouped=false] - Rows under group headings (a list grouped by area, with
 *   ListSubheaders)
 * @param {boolean} [props.card=false] - The rows on an opaque rounded card, as the dashboard's lists are
 *   ({@link DASHBOARD_LIST_SX}), the last without its divider; grouped, one card
 *   per group with its title above (IndexSection's card)
 * @param {number} [props.trailing=0] - How many action icons end each row (edit, delete)
 * @param {number} [props.columns=0] - A table instead (its header row, then one-line rows of that
 *   many cells, the middle one narrow when odd - ConnectionList's arrow)
 */
export default function ListSkeleton({ rows = 6, leading = 'square', secondary = true, count = false, search = false, grouped = false, card = false, trailing = 0, columns = 0, fill = true, className, sx }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref, fill)
  const blocks = toBlocks(layoutItems({ rows, grouped, height, card, rowHeight: columns ? TABLE_ROW_HEIGHT : ROW_HEIGHT }))

  return (
    <Box ref={ref} className={['oc-list-skeleton', className].filter(Boolean).join(' ')} aria-busy="true" sx={[fill && { height: height ?? '100vh', overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" role="status" sx={visuallyHidden}>
        {t('loading')}
      </Box>
      {count && <Skeleton aria-hidden="true" variant="text" sx={{ fontSize: '0.875rem', width: 90, mb: search ? 2 : 1 }} />}
      {search && <Skeleton aria-hidden="true" variant="rounded" sx={(theme) => ({ height: 40, borderRadius: `${/** @type {number} */ (theme.shape.borderRadius) * 4}px`, mb: 2 })} />}
      {blocks.map(({ heading, rows: blockRows }, blockIndex) => (
        <Box key={blockIndex} aria-hidden="true" sx={card && grouped ? { mb: 3 } : undefined}>
          {/* An area's name: above its card, or a subheader row in the list. */}
          {heading != null && card && <Skeleton variant="text" sx={{ fontSize: '1.25rem', width: GROUP_TITLE_WIDTHS[heading % 4], mb: 1.5, ml: 0.5 }} />}
          {heading != null && !card && (
            <Box sx={{ display: 'flex', alignItems: 'center', height: HEADING_HEIGHT, px: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: GROUP_TITLE_WIDTHS[heading % 4] }} />
            </Box>
          )}
          <Box sx={card ? DASHBOARD_LIST_SX : undefined}>
            {columns > 0 && <TableRow columns={columns} header />}
            {columns > 0 && blockRows.map((index) => <TableRow key={index} columns={columns} index={index} />)}
            {columns === 0 && blockRows.map((index, position) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderBottom: card && position === blockRows.length - 1 ? 0 : 1, borderColor: 'divider' }}>
                {leading === 'square' && <Skeleton variant="rounded" width={24} height={24} />}
                {leading === 'circle' && <Skeleton variant="circular" width={32} height={32} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Varied widths, so it doesn't read as a grid of bars. */}
                  <Skeleton variant="text" sx={{ fontSize: '1rem', width: `${[55, 40, 65, 48, 35, 60][index % 6]}%` }} />
                  {secondary && <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: `${[30, 25, 35, 22, 28, 32][index % 6]}%` }} />}
                </Box>
                {Array.from({ length: trailing }, (_, i) => (
                  <Skeleton key={i} variant="circular" width={24} height={24} sx={{ mx: 1.5 }} />
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// The rows (and, when grouped, the headings before each group) - at least
// `rows` rows, and enough to fill `height` once it's measured.
function layoutItems({ rows, grouped, height, card, rowHeight }) {
  const items = []
  let used = 0
  let rowIndex = 0
  let groupIndex = 0
  let leftInGroup = 0
  while (rowIndex < rows || (height && used < height)) {
    if (grouped && leftInGroup === 0) {
      items.push({ heading: true, index: groupIndex })
      used += card ? CARD_GROUP_HEIGHT : HEADING_HEIGHT
      leftInGroup = GROUP_SIZES[groupIndex % GROUP_SIZES.length]
      groupIndex++
    }
    items.push({ heading: false, index: rowIndex })
    used += rowHeight
    rowIndex++
    leftInGroup--
  }
  return items
}

// A table's row: its cells' text, the middle one an icon's width when odd.
function TableRow({ columns, index = 0, header = false }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: header ? 1.25 : 0.75, borderBottom: 1, borderColor: 'divider' }}>
      {Array.from({ length: columns }, (_, cell) =>
        columns % 2 === 1 && cell === (columns - 1) / 2 ? (
          <Box key={cell} sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
            {!header && <Skeleton variant="circular" width={16} height={16} />}
          </Box>
        ) : (
          <Box key={cell} sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: header ? 90 : `${[50, 35, 60, 42, 30, 55][(index + cell) % 6]}%` }} />
          </Box>
        ),
      )}
    </Box>
  )
}

// The items as blocks: a group heading (its index, or null) and its rows'
// indexes - one block for an ungrouped list.
function toBlocks(items) {
  const blocks = []
  for (const item of items) {
    if (item.heading) blocks.push({ heading: item.index, rows: [] })
    else {
      if (blocks.length === 0) blocks.push({ heading: null, rows: [] })
      blocks.at(-1).rows.push(item.index)
    }
  }
  return blocks
}

// Read by screen readers, not drawn.
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
