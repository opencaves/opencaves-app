import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import { centerFocused, leaveOnArrow, scrollStrip, snapOnSettle } from '@/utils/mediaStrip.js'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'

// The strip wrapped around a vertical cylinder, its axis at the middle of
// the strip's visible area: the items bend away on its surface, out of sight
// past its sides. Each item is drawn as narrow vertical slices, each set on
// the curve; the real items stay under them, invisible, turned as their
// column's middle. Its shape's defaults (MediaStrip's props):
const CYLINDER = {
  // A slice's width (px).
  slice: 4,
  perspective: 900,
  // Brought toward us: its front this much larger than the flat strip (the
  // strip taller by as much, so nothing is cut off).
  zoom: 1.25,
  // Its front flat across this share of the strip's width, its sides rounded
  // on a cylinder of `radius` px from the band's edges, in line with it (no
  // crease); what goes past a side's quarter turn is out of sight.
  flat: 0.4,
  radius: 100,
}
// The flat strip for reduced motion.
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A horizontal strip of media - the photos, the videos, the survey maps - its
 * columns given as children: it scrolls by the wheel, a swipe or its
 * scrollbar, the keyboard centring the item it reaches (mediaStrip.js), and
 * is wrapped around a cylinder as it scrolls, snapping column by column -
 * flat, gliding to the nearest item once still, for reduced motion.
 *
 * On the cylinder, an item is drawn as slices: an `.oc-media-strip--picture`
 * from its `<img>` (as object-fit: cover), an `.oc-media-strip--tile` from
 * copies of itself (its overlays curved with it; `.oc-media-strip--see-through`
 * when its background is, so its slices don't overlap). Every item carries
 * `.oc-media-strip--item` (snapping, keyboard).
 *
 * @param {object} props - Also its root's (a Box's).
 * @param {number} props.itemHeight - Its items' height (px), for the room the zoomed cylinder takes.
 * @param {number|string} [props.height=props.itemHeight] - Its row's height, if a CSS length other than itemHeight.
 * @param {number} [props.gap=0] - The space between columns (px).
 * @param {unknown} [props.rebuildKey] - Changes when its items change: the cylinder is made again.
 * @param {boolean} [props.cylinder=true] - On the cylinder (always flat for reduced motion).
 * @param {number} [props.radius=100] - The cylinder's sides' radius (px).
 * @param {number} [props.flat=0.4] - Its flat front's share of the strip's width.
 * @param {number} [props.zoom=1.25] - How much larger its front is than the flat strip.
 * @param {number} [props.perspective=900] - Its perspective (px).
 * @param {number} [props.slice=4] - A slice's width (px).
 * @param {import('react').RefObject<any>} [props.scrollbarsRef] - Its Scrollbars, for a caller scrolling it (their `view`).
 * @param {import('react').ReactNode} props.children - Its columns.
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 */
export default function MediaStrip({ itemHeight, height = itemHeight, gap = 0, rebuildKey, cylinder = true, radius: sideRadius = CYLINDER.radius, flat: flatShare = CYLINDER.flat, zoom = CYLINDER.zoom, perspective = CYLINDER.perspective, slice: sliceWidth = CYLINDER.slice, scrollbarsRef: callerScrollbarsRef, children, className, sx, ...props }) {
  const ownScrollbarsRef = useRef(null)
  const scrollbarsRef = callerScrollbarsRef ?? ownScrollbarsRef
  const rowRef = useRef(null)
  const sliceLayerRef = useRef(null)
  const cylinderOn = () => cylinder && !reducedMotion()
  // Above and below the strip: room for the zoomed cylinder.
  const zoomRoom = cylinderOn() ? Math.ceil((itemHeight * (zoom - 1)) / 2) : 0
  const rowHeight = typeof height === 'number' ? `${height}px` : height

  useEffect(() => {
    const scrollbar = scrollbarsRef.current
    const container = scrollbar?.container
    if (!container) return undefined

    function onWheel(event) {
      event.preventDefault()
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const width = scrollWidth - clientWidth
      const wheelDirection = Math.sign(event.deltaY || event.deltaX)
      if (!wheelDirection || width <= 0) return
      if ((wheelDirection < 0 && Math.round(scrollLeft) <= 0) || (wheelDirection > 0 && Math.round(scrollLeft) >= width)) return

      // Snapping (the cylinder): a native scroll, which the browser takes to
      // the next column that way; flat, the wheel's own distance (scrollStrip).
      if (scrollbar.view.style.scrollSnapType) {
        scrollbar.view.scrollBy({ left: wheelDirection, behavior: 'smooth' })
        return
      }
      scrollStrip(scrollbar.view, event)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    // The cylinder snaps with CSS (scroll-snap, its effect below); flat, the
    // strip glides to the nearest item once still.
    const stopSnapping = cylinderOn() ? () => {} : snapOnSettle(scrollbar.view, container)
    return () => {
      container.removeEventListener('wheel', onWheel)
      stopSnapping()
    }
  }, [rebuildKey, cylinder])

  // The cylinder: its slices made again when the items or
  // the sizes change, placed again on each scroll - straight on the DOM, no
  // re-render. Flat for reduced motion.
  useEffect(() => {
    const view = scrollbarsRef.current?.view
    const row = rowRef.current
    const layer = sliceLayerRef.current
    if (!view || !row || !layer || !cylinderOn()) return undefined
    const columnsOf = () => [...row.children].filter((column) => column !== layer)
    if (!columnsOf().length) return undefined

    // An element's place in the row as laid out (offsets ignore transforms).
    function rowOffset(element) {
      let x = 0
      let y = 0
      for (let e = element; e && e !== row; e = /** @type {HTMLElement} */ (e.offsetParent)) {
        x += e.offsetLeft
        y += e.offsetTop
      }
      return { x, y }
    }

    let slices = []
    let images = []
    let tiles = []
    function build() {
      layer.replaceChildren()
      slices = []
      // CSS scroll snapping on each column's middle. Its snap points are the
      // targets' transformed boxes: the turned columns would shift them, so
      // they're invisible guides at each column's flat place instead.
      for (const column of columnsOf()) {
        const guide = document.createElement('div')
        Object.assign(guide.style, { position: 'absolute', left: `${rowOffset(column).x}px`, top: '0', width: `${column.offsetWidth}px`, height: '1px', scrollSnapAlign: 'center' })
        layer.append(guide)
      }
      // A tile (a video, a map, "more photos", "add photos"): each slice a
      // copy of it, clipped to its strip - out of reach, the real one under it.
      tiles = /** @type {HTMLElement[]} */ ([...row.querySelectorAll('.oc-media-strip--tile')]).filter((tile) => !layer.contains(tile))
      for (const tile of tiles) {
        tile.style.opacity = ''
        const { x, y } = rowOffset(tile)
        const w = tile.offsetWidth
        const h = tile.offsetHeight
        const seeThrough = tile.classList.contains('oc-media-strip--see-through')
        for (let sx = 0; sx < w; sx += sliceWidth) {
          const sw = Math.min(sliceWidth, w - sx)
          const slice = document.createElement('div')
          // A hair wider, no seams between slices - exactly its width when
          // it's see-through, where an overlap would show a darker seam.
          Object.assign(slice.style, { position: 'absolute', left: `${x + sx}px`, top: `${y}px`, width: `${seeThrough ? sw : sw + 0.5}px`, height: `${h}px`, overflow: 'hidden', backfaceVisibility: 'hidden' })
          const copy = /** @type {HTMLElement} */ (tile.cloneNode(true))
          copy.inert = true
          // Not what the cylinder set on the real one, when it's a column
          // itself (turned, or hidden past a side).
          Object.assign(copy.style, { position: 'absolute', left: `${-sx}px`, top: '0', width: `${w}px`, height: `${h}px`, margin: '0', opacity: '', transform: 'none', visibility: 'visible', pointerEvents: 'none' })
          slice.append(copy)
          layer.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
        tile.style.opacity = '0'
      }
      images = /** @type {HTMLImageElement[]} */ ([...row.querySelectorAll('.oc-media-strip--picture img')]).filter((img) => !layer.contains(img))
      for (const img of images) {
        const box = /** @type {HTMLElement} */ (img.closest('.oc-media-strip--picture'))
        const src = img.currentSrc
        if (!src || !img.naturalWidth) continue
        const { x, y } = rowOffset(box)
        const w = box.offsetWidth
        const h = box.offsetHeight
        // As object-fit: cover.
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
        const bw = img.naturalWidth * scale
        const bh = img.naturalHeight * scale
        const count = Math.ceil(w / sliceWidth)
        for (let i = 0; i < count; i++) {
          const sx = i * sliceWidth
          const sw = Math.min(sliceWidth, w - sx)
          const slice = document.createElement('div')
          // A hair wider: no seams between slices.
          Object.assign(slice.style, {
            position: 'absolute',
            left: `${x + sx}px`,
            top: `${y}px`,
            width: `${sw + 0.5}px`,
            height: `${h}px`,
            backgroundImage: `url("${src}")`,
            backgroundSize: `${bw}px ${bh}px`,
            backgroundPosition: `${(w - bw) / 2 - sx}px ${(h - bh) / 2}px`,
            backfaceVisibility: 'hidden',
            borderRadius: i === 0 ? '.5rem 0 0 .5rem' : i === count - 1 ? '0 .5rem .5rem 0' : '0',
          })
          layer.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
        img.style.opacity = '0'
      }
    }

    // Where a point of the flat strip lands on the cylinder: its arc from the
    // middle is its distance on the strip. Flat across the front band, then
    // round on the sides' radius.
    // Forward by as much as makes its front `zoom` times larger.
    const forward = perspective * (1 - 1 / zoom)
    function place(x, center, radius) {
      const flat = radius * flatShare
      const bend = sideRadius
      const distance = x - center
      const side = Math.sign(distance)
      const theta = Math.max(0, Math.abs(distance) - flat) / bend
      const shift = side * (Math.min(Math.abs(distance), flat) + bend * Math.sin(theta)) + center - x
      const depth = forward + bend * (Math.cos(theta) - 1)
      return { theta, transform: `translate3d(${shift}px, 0, ${depth}px) rotateY(${-side * theta}rad)` }
    }

    let frame
    let stale = true
    function layout() {
      frame = undefined
      const columns = columnsOf()
      if (!columns.length) return
      if (stale) {
        // Room before the first column and after the last: either can be
        // scrolled to the middle - the strip starts on the first one there.
        const padding = parseFloat(getComputedStyle(row.parentElement).paddingLeft) || 0
        row.style.marginLeft = `${Math.max(0, view.clientWidth / 2 - columns[0].offsetWidth / 2 - padding)}px`
        row.style.marginRight = `${Math.max(0, view.clientWidth / 2 - columns.at(-1).offsetWidth / 2 - padding)}px`
        // The row's flat plane is in front of the turned items: it lets the
        // pointer through to them.
        row.style.pointerEvents = 'none'
        for (const column of columns) column.style.pointerEvents = 'auto'
        build()
        stale = false
      }
      const viewRect = view.getBoundingClientRect()
      // No scrolling past the first or the last column in the middle (the
      // turned slices make the strip scroll further than its own width).
      const middle = viewRect.left + viewRect.width / 2
      const firstMiddle = row.getBoundingClientRect().left + columns[0].offsetLeft + columns[0].offsetWidth / 2
      const lastMiddle = row.getBoundingClientRect().left + columns.at(-1).offsetLeft + columns.at(-1).offsetWidth / 2
      const past = Math.min(0, lastMiddle - middle) || Math.max(0, firstMiddle - middle)
      if (Math.abs(past) >= 1) {
        view.scrollLeft += past
      }
      const rowLeft = row.getBoundingClientRect().left
      const center = viewRect.left + viewRect.width / 2 - rowLeft
      const radius = viewRect.width / 2
      row.style.perspective = `${perspective}px`
      row.style.perspectiveOrigin = `${center}px 50%`
      for (const { slice, x } of slices) {
        const { theta, transform } = place(x, center, radius)
        // Past the cylinder's sides: out of sight.
        const hidden = Math.abs(theta) > Math.PI / 2
        slice.style.visibility = hidden ? 'hidden' : ''
        if (!hidden) slice.style.transform = transform
      }
      // The real items, turned as their column's middle.
      for (const column of columns) {
        const { x } = rowOffset(column)
        const { theta, transform } = place(x + column.offsetWidth / 2, center, radius)
        column.style.visibility = Math.abs(theta) > Math.PI / 2 ? 'hidden' : ''
        column.style.transform = transform
      }
    }
    function schedule() {
      frame ??= requestAnimationFrame(layout)
    }
    function rebuild() {
      stale = true
      schedule()
    }
    // A thumbnail loaded (they're lazy): its slices can be made - not the
    // slices' own copies loading theirs, or it would never end.
    function onLoad(event) {
      if (!layer.contains(event.target)) rebuild()
    }

    layout()
    view.style.scrollSnapType = 'x mandatory'
    view.addEventListener('scroll', schedule, { passive: true })
    row.addEventListener('load', onLoad, true)
    const observer = new ResizeObserver(rebuild)
    observer.observe(view)
    observer.observe(row)
    return () => {
      cancelAnimationFrame(frame)
      view.style.scrollSnapType = ''
      view.removeEventListener('scroll', schedule)
      row.removeEventListener('load', onLoad, true)
      observer.disconnect()
      layer.replaceChildren()
      for (const img of images) img.style.opacity = ''
      for (const tile of tiles) tile.style.opacity = ''
      for (const column of columnsOf()) {
        column.style.transform = ''
        column.style.visibility = ''
        column.style.pointerEvents = ''
      }
      Object.assign(row.style, { marginLeft: '', marginRight: '', pointerEvents: '' })
    }
  }, [rebuildKey, cylinder, sideRadius, flatShare, zoom, perspective, sliceWidth])

  return (
    <Box
      className={`oc-media-strip ${className || ''}`.trim()}
      sx={[(theme) => ({
        // TRIAL: a band of its own tone behind the cylinder, as tall as the
        // items in front (zoomed on the cylinder) - lighter than the pane in
        // dark mode, a faint tint in light mode.
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: `calc(${rowHeight} + ${zoomRoom * 2}px)`,
          bgcolor: theme.vars.sys.color.surfaceContainer,
          ...theme.applyStyles('dark', { bgcolor: theme.vars.sys.color.surfaceContainerHighest }),
        },
      }), { position: 'relative', marginBottom: 'calc(var(--oc-pane-padding-block) * -1)', height: `calc(var(--oc-pane-padding-block) + ${rowHeight} + ${zoomRoom * 2}px)` }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      <Scrollbars
        ref={scrollbarsRef}
        autoHide
        autoHeight
        autoHeightMax={itemHeight + zoomRoom * 2 + 100}
        trackHorizontalProps={{
          style: {
            left: 'calc(var(--oc-pane-padding-inline) / 2)',
            right: 'calc(var(--oc-pane-padding-inline) / 2)',
            bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)`,
          },
        }}
      >
        <Box onFocus={(event) => centerFocused(event, scrollbarsRef.current?.view)} onKeyDown={leaveOnArrow} sx={{ px: 'var(--oc-pane-padding-inline)', py: `${zoomRoom}px`, mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
          <Box ref={rowRef} className="oc-media-strip--row" sx={{ position: 'relative', width: 'min-content', display: 'flex', flexWrap: 'nowrap', gap: `${gap}px`, transformStyle: 'preserve-3d' }}>
            {children}
            {/* The items' slices on the cylinder (filled by its effect). */}
            <Box ref={sliceLayerRef} className="oc-media-strip--cylinder" aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformStyle: 'preserve-3d' }} />
          </Box>
        </Box>
      </Scrollbars>
    </Box>
  )
}
