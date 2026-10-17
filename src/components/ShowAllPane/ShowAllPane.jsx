import { Children, isValidElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Dialog, IconButton, Typography, styled } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import { usePaneSwap } from '@/hooks/usePaneSwap.js'
import Reorderable, { CoverBadge } from '@/components/Reorder/Reorderable.jsx'

// The items' corners: MD3's extra-large shape (28dp), as its carousel's. The
// pane keeps the class names of the carousel it came from (oc-carousel--*),
// which the pages' items still carry.
const ITEM_RADIUS = 28

// The pane's items: their visual's corners, and a photo's <picture> filling
// it (its <img> at 100% of it: a photo wider than its tile kept its own
// height otherwise, a band of the tile left under it).
const GRID_SX = { '& .oc-carousel--media': { borderRadius: `${ITEM_RADIUS}px` }, '& .oc-carousel--media > picture': { width: '100%', height: '100%' } }
const PANE_EDGE_SX = (theme) => ({ '& .MuiDialog-paper': { border: `12px solid ${theme.vars.palette.background.default}` } })

/**
 * Every item of a strip, in a vertical grid (MD3: on a
 * vertically scrolling page, a way to see them all without scrolling
 * sideways): a pane, full screen on phones (two columns there, swapped in -
 * {@link usePaneSwap}), with a back arrow and the list's title. Its children: `<li>`s, each
 * one's visual marked `.oc-carousel--media`.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.gridMinWidth='200px'] - A column's narrowest.
 * @param {number | string} [props.gridGap=2]
 * @param {React.ReactNode} [props.children]
 * @param {ShowAllSortable} [props.sortable] - Editors reorder the items (each `<li>` keyed by its id).
 */
export function ShowAllPane({ open, onClose, title, gridMinWidth = '200px', gridGap = 2, children, sortable }) {
  const { t } = useTranslation('app')
  const isPhone = useSmall()
  // Phones: swapped in (usePaneSwap).
  const { swap, paperRef, enter, close: swapClose } = usePaneSwap(isPhone)
  const close = () => swapClose(onClose)

  return (
    <Dialog
      className="oc-carousel--pane"
      open={open}
      onClose={close}
      fullScreen={isPhone}
      fullWidth
      maxWidth="lg"
      aria-labelledby="oc-carousel-pane-title"
      scroll="paper"
      // On wider screens, a 12dp frame in the page's ground colour (the one
      // between the page's panels), inside the pane's rounded corners, sets
      // the pane apart from the page behind it; full screen on phones, it
      // has no page around it to stand out from.
      sx={isPhone ? undefined : PANE_EDGE_SX}
      {...(swap && {
        hideBackdrop: true,
        transitionDuration: 0,
        // Once the pane's content is in the page (the dialog mounts it after
        // opening).
        slotProps: { paper: { ref: paperRef }, transition: { onEntering: enter } },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, minHeight: 64, flexShrink: 0 }}>
        <IconButton onClick={close} aria-label={t('back')} sx={{ width: 48, height: 48 }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography id="oc-carousel-pane-title" component="h2" variant="h6" noWrap>
          {title}
        </Typography>
      </Box>
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', px: 2, pb: 2 }}>
        {sortable ? (
          <SortableGrid sortable={sortable} wrap={(items) => <Grid gridMinWidth={gridMinWidth} gridGap={gridGap} label={title} columns={isPhone ? 2 : undefined} sx={GRID_SX}>{items}</Grid>}>
            {children}
          </SortableGrid>
        ) : (
          <Grid gridMinWidth={gridMinWidth} gridGap={gridGap} label={title} columns={isPhone ? 2 : undefined} sx={GRID_SX}>
            {children}
          </Grid>
        )}
      </Box>
    </Dialog>
  )
}

/**
 * A Show all pane's items, editors reordering them: what to reorder and how
 * it's saved.
 *
 * @typedef {object} ShowAllSortable
 * @property {boolean} enabled - Editors: sortable (the others see the items as they are).
 * @property {string[]} ids - The items' ids, in the order shown (each `<li>`'s key).
 * @property {(ids: string[]) => void} onReorder - The new order, on a drop.
 * @property {(id: string) => string} [groupOf] - An item's group, which it can't leave (a cave's maps: their system).
 * @property {boolean} [coverFirst] - The first item is the cover (photos): it says so.
 */

// A sortable item: raised while dragged. Styled once (not an sx computed per
// item and render: a drag starting re-renders them all).
const SortableItemLi = styled('li')(({ theme }) => ({
  '& .oc-carousel--media': { transition: theme.transitions.create('box-shadow', { duration: theme.sys.motion.duration.standard, easing: theme.sys.motion.easing.standard }) },
  '&[data-dragging] .oc-carousel--media': { boxShadow: theme.shadows[8] },
}))
const COVER_BADGE_SX = { top: 12, insetInlineStart: 12 }

/**
 * The pane's items, sortable by editors ({@link Reorderable}): each `<li>`
 * child drawn again, dragged as a whole (it still opens on a click),
 * lifted while dragged (MD3's dragged state: a raised shadow), and, with
 * coverFirst, "Cover" on the first.
 *
 * @param {object} props
 * @param {ShowAllSortable} props.sortable
 * @param {(items: React.ReactNode[]) => React.ReactNode} props.wrap - Puts the items in the grid.
 * @param {React.ReactNode} [props.children] - `<li>`s keyed by their ids.
 */
function SortableGrid({ sortable, wrap, children }) {
  const byId = new Map()
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.key != null) byId.set(String(child.key), child)
  })
  const ids = sortable.ids.filter((id) => byId.has(id))
  /** @type {SortableRenderItem} */
  const renderItem = (id, index, state) => {
    const child = /** @type {React.ReactElement<{children?: React.ReactNode}>} */ (byId.get(id))
    if (!state) return child
    return (
      <SortableItemLi key={id} {...state.itemProps} className="oc-carousel--sortable-item" data-dragging={state.isDragging || undefined}>
        {child.props.children}
        {sortable.coverFirst && index === 0 && <CoverBadge sx={COVER_BADGE_SX} />}
      </SortableItemLi>
    )
  }
  return <Reorderable enabled={sortable.enabled} ids={ids} renderItem={renderItem} onReorder={sortable.onReorder} groupOf={sortable.groupOf} wrap={wrap} />
}

/**
 * The items in a grid, as many columns as fit (or `columns`, a fixed number).
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children]
 * @param {string} props.gridMinWidth - A column's narrowest.
 * @param {number | string} props.gridGap
 * @param {number} [props.columns]
 * @param {string} props.label
 * @param {Sx} [props.sx]
 */
function Grid({ children, gridMinWidth, gridGap, columns, label, sx }) {
  return (
    <Box component="ul" aria-label={label} sx={[{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(min(${gridMinWidth}, 100%), 1fr))`, gap: gridGap }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  )
}
