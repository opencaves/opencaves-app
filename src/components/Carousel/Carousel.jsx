import { Children, isValidElement, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, IconButton, Typography, styled } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import Reorderable, { CoverBadge } from '@/components/Reorder/Reorderable.jsx'

// MD3's carousel, uncontained layout
// (m3.material.io/components/carousel/specs): 16dp leading padding, 8dp
// above and below and between items, item corners 28dp (extra-large shape).
const ITEM_RADIUS = 28
// Pressed, an item's shape changes slightly.
const PRESSED_RADIUS = 20
const GAP = 8
const END_PADDING = 16
const BLOCK_PADDING = 8
// One width for every item (MD3's uncontained items don't change size): the
// next one peeks in at the end.
const ITEM_WIDTH = '80%'
// Parallax: the visual is this much wider than its item, and slides across
// it as the item crosses the carousel (the oc-carousel-parallax keyframes in
// variables.scss, matched to it: half the extra width each way).
const PARALLAX = 0.2

// The Show all pane's transition on phones (MD3's carousel guidelines): the
// two screens swap side by side - the page squeezes toward its start edge,
// shrinking in width, as the pane grows in from the end edge; back, the
// reverse. MD3's emphasized easing, long duration. With reduced motion, a
// fade.
const SWAP = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
// The pane's items: their visual's corners, and a photo's <picture> filling
// it (its <img> at 100% of it: a photo wider than its tile kept its own
// height otherwise, a band of the tile left under it).
const GRID_SX = { '& .oc-carousel--media': { borderRadius: `${ITEM_RADIUS}px` }, '& .oc-carousel--media > picture': { width: '100%', height: '100%' } }
const PANE_EDGE_SX = (theme) => ({ '& .MuiDialog-paper': { border: `12px solid ${theme.vars.palette.background.default}` } })
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Every item of a carousel or a strip, in a vertical grid (MD3: on a
 * vertically scrolling page, a way to see them all without scrolling
 * sideways): a pane, full screen on phones (two columns there, swapped in -
 * SWAP), with a back arrow and the list's title. Its children: `<li>`s, each
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
  const swap = isPhone && !prefersReducedMotion()
  const paperRef = useRef(null)
  const animations = useRef([])
  const closingRef = useRef(false)

  // The swap, one way: the page (the app, outside the dialog's portal) and
  // the pane, each squeezed from its own edge.
  function animateSwap(forward) {
    const page = document.getElementById('root')
    const pane = paperRef.current
    animations.current.forEach((animation) => animation.cancel())
    if (!page || !pane) return (animations.current = [])
    const direction = forward ? 'normal' : 'reverse'
    animations.current = [
      page.animate([{ transformOrigin: '0 50%', transform: 'none' }, { transformOrigin: '0 50%', transform: 'scaleX(0)' }], { ...SWAP, direction, fill: 'both' }),
      pane.animate([{ transformOrigin: '100% 50%', transform: 'scaleX(0)' }, { transformOrigin: '100% 50%', transform: 'none' }], { ...SWAP, direction, fill: 'both' }),
    ]
    return animations.current
  }
  // Leaving the page (an item opened) with the pane open: the page back.
  useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), [])

  function close() {
    if (!swap) return onClose()
    if (closingRef.current) return undefined
    closingRef.current = true
    const [pageAnimation, paneAnimation] = animateSwap(false)
    Promise.all([pageAnimation, paneAnimation].map((animation) => animation?.finished.catch(() => {}))).then(() => {
      // The page's animation ends where it started: dropping it changes
      // nothing. The pane's stays (squeezed to nothing) until the pane is
      // gone - dropping it first would show the pane again for a frame.
      pageAnimation?.cancel()
      animations.current = paneAnimation ? [paneAnimation] : []
      closingRef.current = false
      onClose()
    })
    return undefined
  }

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
        slotProps: { paper: { ref: paperRef }, transition: { onEntering: () => animateSwap(true) } },
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
 * @param {React.Ref<HTMLUListElement>} [props.listRef]
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 */
function Grid({ children, gridMinWidth, gridGap, columns, label, listRef, className, sx }) {
  return (
    <Box ref={listRef} component="ul" className={className} aria-label={label} sx={[{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(min(${gridMinWidth}, 100%), 1fr))`, gap: gridGap }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  )
}

// Left and right arrows move to the previous or next item (MD3's keyboard
// navigation; Tab does too): the item's link gets the focus, and the
// carousel scrolls it in.
function onArrowKey(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const item = event.target.closest('.oc-carousel--scroller > li')
  const next = event.key === 'ArrowRight' ? item?.nextElementSibling : item?.previousElementSibling
  const target = next?.querySelector('a, button, [tabindex]')
  if (!target) return
  event.preventDefault()
  target.focus()
}

/**
 * A list of media (photos, maps), each child one item (a <li>), its visual
 * (the part with rounded corners) marked .oc-carousel--media and any text
 * under it. On phones, an MD3 carousel in the uncontained layout: items of
 * one size flowing past the edge, snap-scrolled (each item settling in the
 * middle; the first and last as near as they can - MD3: both scrollings suit
 * this layout); it runs to the edges of its card (bleed: the card's
 * padding, cancelled), items passing over its padding. Its items: a hover
 * and pressed state layer, a slightly changed shape while pressed, and their
 * visual sliding inside them as they scroll (parallax, without reduced
 * motion).
 * Wider screens: a grid of columns at least gridMinWidth wide. Under it, a
 * Show all link opening every item (allItems, or the items) in a pane - on
 * phones, or when allItems has more than the items shown.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - The items it shows.
 * @param {React.ReactNode[]} [props.allItems]
 * @param {string} [props.gridMinWidth='200px']
 * @param {number} [props.gridGap=2]
 * @param {number} [props.bleed=2]
 * @param {string} props.label - The list's name (the pane's title too), said with "carousel".
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 */
export default function Carousel({ children, allItems, gridMinWidth = '200px', gridGap = 2, bleed = 2, label, className, sx }) {
  const { t } = useTranslation('app', { keyPrefix: 'carousel' })
  const isPhone = useSmall()
  const [paneOpen, setPaneOpen] = useState(false)
  const classes = ['oc-carousel', className].filter(Boolean).join(' ')
  const showAll = isPhone || (allItems && allItems.length > (Array.isArray(children) ? children.length : 1))

  const list = !isPhone ? (
    <Grid className={classes} gridMinWidth={gridMinWidth} gridGap={gridGap} label={label} sx={sx}>
      {children}
    </Grid>
  ) : (
    <Box
      component="ul"
      className={`${classes} oc-carousel--scroller`}
      aria-label={label && t('label', { title: label })}
      onKeyDown={onArrowKey}
      sx={[
        (theme) => ({
          '--oc-carousel-radius': `${ITEM_RADIUS}px`,
          listStyle: 'none',
          m: 0,
          mx: -bleed,
          px: `${END_PADDING}px`,
          scrollSnapType: 'x mandatory',
          // MD3's 8dp, also room for a focused item's ring (3px, 2px out).
          py: `${BLOCK_PADDING}px`,
          display: 'flex',
          gap: `${GAP}px`,
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          // Swiped, not scrolled with a bar.
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > li': { flex: `0 0 ${ITEM_WIDTH}`, minWidth: 0, scrollSnapAlign: 'center' },
          '& > li:active': { '--oc-carousel-radius': `${PRESSED_RADIUS}px` },
          '& .oc-carousel--media': {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--oc-carousel-radius)',
            transition: theme.transitions.create('border-radius', { duration: theme.transitions.duration.shortest }),
            // Its edge (so a white map shows where it ends on a light card)
            // and its state layer, over it - not an outline, which would
            // replace the keyboard focus ring.
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow: `inset 0 0 0 1px ${theme.vars.sys.color.outlineVariant}`,
              bgcolor: 'transparent',
              transition: theme.transitions.create('background-color', { duration: theme.transitions.duration.shortest }),
              pointerEvents: 'none',
            },
          },
          '& li:hover .oc-carousel--media::after': { bgcolor: `rgba(${theme.vars.palette.text.primaryChannel} / 0.08)` },
          '& li:active .oc-carousel--media::after': { bgcolor: `rgba(${theme.vars.palette.text.primaryChannel} / 0.1)` },
          // The ripple, within the visual (a map's item has text under it).
          '& .MuiTouchRipple-root': { bottom: 'auto', aspectRatio: '4 / 3', borderRadius: 'var(--oc-carousel-radius)' },
          // Parallax: where the browser drives animations by scrolling.
          '@supports (animation-timeline: view())': {
            '@media (prefers-reduced-motion: no-preference)': {
              '& .oc-carousel--media img': {
                width: `${(1 + PARALLAX) * 100}% !important`,
                maxWidth: 'none',
                marginLeft: `${(-PARALLAX / 2) * 100}%`,
                animationName: 'oc-carousel-parallax',
                animationTimingFunction: 'linear',
                animationFillMode: 'both',
                animationTimeline: 'view(inline)',
              },
            },
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  )

  return (
    <>
      {list}
      {showAll && (
        <>
          {/* MD3's Show all button, right under the carousel at its end (into
              its bottom padding): a small text button, still a 48dp target. */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: isPhone ? '-6px' : 0.5, mb: -1.5, mr: -1 }}>
            <Button size="small" className="oc-carousel--show-all" onClick={() => setPaneOpen(true)} aria-label={t('showAll', { title: label })} aria-haspopup="dialog" sx={{ minHeight: 32, position: 'relative', '&::before': { content: '""', position: 'absolute', inset: '-8px 0' } }}>
              {t('showAllLink')}
            </Button>
          </Box>
          <ShowAllPane open={paneOpen} onClose={() => setPaneOpen(false)} title={label} gridMinWidth={gridMinWidth} gridGap={gridGap}>
            {allItems || children}
          </ShowAllPane>
        </>
      )}
    </>
  )
}
