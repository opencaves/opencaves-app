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
// A wheel notch's scroll (px; Chrome's is 100, times the display's scaling):
// what moves the cylinder a column.
const WHEEL_NOTCH = 100
// How far a slice reaches over the next one (px). Each slice is drawn on its
// own, its edges blended with what's behind; half a pixel left that blend
// showing - the band through a thin line every slice. Two cover it (the next
// slice draws over the same picture).
const SLICE_OVERLAP = 2

// The strip's columns' scroll positions, in order: where each snap guide (the
// cylinder's, at a column's flat place) is in the middle of the view. The
// view's middle is its visible area's (clientWidth, as snapping's): its box
// is wider by the native scrollbar it hides (17px on Windows), and measuring
// with that put every middle 8px off snapping's - at the strip's end, its
// "not past the last column" check then fought snapping, and no scroll back
// got through.
function snapPoints(view) {
  const viewRect = view.getBoundingClientRect()
  const middle = viewRect.left + view.clientLeft + view.clientWidth / 2
  return [...view.querySelectorAll('.oc-media-strip--guides > div')].map((guide) => {
    const rect = guide.getBoundingClientRect()
    return view.scrollLeft + rect.left + rect.width / 2 - middle
  }).sort((a, b) => a - b)
}

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
 * @param {'center'|'start'} [props.start='center'] - Where its first item is at first, on the cylinder: in the middle
 *   (a snap point), or flush with the viewing area's start - its left, its right in a right-to-left language (no snap
 *   point there: snapping waits for the reader's first scroll, wheel, touch or key).
 * @param {boolean} [props.cylinder=true] - On the cylinder (always flat for reduced motion).
 * @param {number} [props.radius=100] - The cylinder's sides' radius (px).
 * @param {number} [props.flat=0.4] - Its flat front's share of the strip's width.
 * @param {number} [props.zoom=1.25] - How much larger its front is than the flat strip.
 * @param {number} [props.perspective=900] - Its perspective (px).
 * @param {number} [props.slice=4] - A slice's width (px).
 * @param {boolean} [props.fill=false] - The sides' radius grows with a wide strip, so the cylinder spans its whole width
 *   (with `radius` alone, a wide strip's cylinder takes only its middle); its band behind fills the whole strip, as
 *   tall as its zoomed front plus `gap` above and below.
 * @param {import('react').RefObject<any>} [props.scrollbarsRef] - Its Scrollbars, for a caller scrolling it (their `view`).
 * @param {import('react').ReactNode} props.children - Its columns.
 * @param {string} [props.className]
 * @param {Sx} [props.sx]
 */
export default function MediaStrip({ itemHeight, height = itemHeight, gap = 0, rebuildKey, start = 'center', cylinder = true, radius: sideRadius = CYLINDER.radius, flat: flatShare = CYLINDER.flat, zoom = CYLINDER.zoom, perspective = CYLINDER.perspective, slice: sliceWidth = CYLINDER.slice, fill = false, scrollbarsRef: callerScrollbarsRef, children, className, sx, ...props }) {
  const ownScrollbarsRef = useRef(null)
  const scrollbarsRef = callerScrollbarsRef ?? ownScrollbarsRef
  const rowRef = useRef(null)
  // The snap guides, in the scrolled row; the slices, on a stage outside the
  // scrolling (its track moved by the layout, in step with their bending).
  const sliceLayerRef = useRef(null)
  const stageRef = useRef(null)
  const trackRef = useRef(null)
  const cylinderOn = () => cylinder && !reducedMotion()
  const rowHeight = typeof height === 'number' ? `${height}px` : height
  // Above and below the strip: room for the zoomed cylinder - the items'
  // own height's (a CSS length when they're sized by CSS: smaller on a
  // phone), not the largest's.
  // A filling strip (a page's): the gap between its items above and below
  // too, so the zoomed front isn't flush with its band.
  const zoomShare = cylinderOn() ? (zoom - 1) / 2 : 0
  const margin = fill ? gap : 0
  const zoomRoom = `calc(${rowHeight} * ${zoomShare} + ${margin}px)`
  const zoomRoomMax = Math.ceil(itemHeight * zoomShare) + margin

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
      // Forward is the reading direction: toward the left, at negative
      // positions, right to left.
      const rtl = getComputedStyle(scrollbar.view).direction === 'rtl'
      const progress = rtl ? -scrollLeft : scrollLeft
      if ((wheelDirection < 0 && Math.round(progress) <= 0) || (wheelDirection > 0 && Math.round(progress) >= width)) return

      // Snapping (the cylinder): a column a notch, from the one the last
      // notches were heading to (quick notches add up, rather than each one
      // starting again from where the glide is), the browser landing it on
      // that column's snap point; flat, the wheel's own distance
      // (scrollStrip). Not a 1px nudge left to snapping: at the strip's end,
      // Chrome snapped it back where it was.
      if (scrollbar.view.style.scrollSnapType) {
        // A notch's worth of wheel first: a high-resolution or free-spinning
        // wheel sends a notch as several small events, each of which moved a
        // column (too fast). Added up the same way, at most a column an event,
        // the rest dropped; started again after a pause or turning back.
        const amount = Math.abs(event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1)
        if (wheelDirection !== wheelTurn) wheelSum = 0
        wheelTurn = wheelDirection
        clearTimeout(wheelPause)
        wheelPause = setTimeout(() => (wheelSum = 0), 250)
        wheelSum += amount
        if (wheelSum < WHEEL_NOTCH) return
        wheelSum = 0
        const view = scrollbar.view
        const points = snapPoints(view)
        if (!points.length) return
        const nearest = points.reduce((best, point, index) => (Math.abs(point - view.scrollLeft) < Math.abs(points[best] - view.scrollLeft) ? index : best), 0)
        const from = headingTo ?? nearest
        headingTo = Math.min(points.length - 1, Math.max(0, from + (rtl ? -wheelDirection : wheelDirection)))
        clearTimeout(headingTimer)
        // Once still a moment, from where it is again.
        headingTimer = setTimeout(() => (headingTo = null), 450)
        view.scrollTo({ left: points[headingTo], behavior: reducedMotion() ? 'auto' : 'smooth' })
        return
      }
      scrollStrip(scrollbar.view, event)
    }
    let headingTo = null
    let headingTimer
    let wheelSum = 0
    let wheelTurn = 0
    let wheelPause

    container.addEventListener('wheel', onWheel, { passive: false })
    // The cylinder snaps with CSS (scroll-snap, its effect below); flat, the
    // strip glides to the nearest item once still.
    const stopSnapping = cylinderOn() ? () => {} : snapOnSettle(scrollbar.view, container)
    return () => {
      container.removeEventListener('wheel', onWheel)
      clearTimeout(headingTimer)
      clearTimeout(wheelPause)
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
    const stage = stageRef.current
    const stageTrack = trackRef.current
    if (!view || !row || !layer || !stage || !stageTrack || !cylinderOn()) return undefined
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
      stageTrack.replaceChildren()
      slices = []
      // CSS scroll snapping on each column's middle. Its snap points are the
      // targets' transformed boxes: the turned columns would shift them, so
      // they're invisible guides at each column's flat place instead.
      for (const column of columnsOf()) {
        const guide = document.createElement('div')
        Object.assign(guide.style, { position: 'absolute', left: `${rowOffset(column).x}px`, top: '0', width: `${column.offsetWidth}px`, height: '1px', scrollSnapAlign: 'center' })
        layer.append(guide)
      }
      // A picture as slices of its image (as object-fit: cover), filling
      // `box` - its corners rounded as the box's.
      function slicePicture(img, box) {
        const { x, y } = rowOffset(box)
        const w = box.offsetWidth
        const h = box.offsetHeight
        const radius = getComputedStyle(box).borderTopLeftRadius || '.5rem'
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
        const bw = img.naturalWidth * scale
        const bh = img.naturalHeight * scale
        const count = Math.ceil(w / sliceWidth)
        for (let i = 0; i < count; i++) {
          const sx = i * sliceWidth
          const sw = Math.min(sliceWidth, w - sx)
          const slice = document.createElement('div')
          // Over the next one by SLICE_OVERLAP: no seams between slices (not
          // the last, its corner rounded).
          Object.assign(slice.style, {
            position: 'absolute',
            left: `${x + sx}px`,
            top: `${y}px`,
            width: `${i === count - 1 ? sw : sw + SLICE_OVERLAP}px`,
            height: `${h}px`,
            backgroundImage: `url("${img.currentSrc}")`,
            backgroundSize: `${bw}px ${bh}px`,
            backgroundPosition: `${(w - bw) / 2 - sx}px ${(h - bh) / 2}px`,
            backfaceVisibility: 'hidden',
            borderRadius: count === 1 ? radius : i === 0 ? `${radius} 0 0 ${radius}` : i === count - 1 ? `0 ${radius} ${radius} 0` : '0',
          })
          stageTrack.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
      }
      const loaded = (img) => Boolean(img.currentSrc && img.naturalWidth)

      // A tile (a video, a map, "more photos", "add photos"): each slice a
      // copy of it, clipped to its strip - out of reach, the real one under it.
      // Its picture (an image filling it: a video's still, a map's thumbnail)
      // drawn as a photo is, slices of the image itself - copies redrew it a
      // little differently each, thin lines between them; in the copies, over
      // it, that image hidden and the boxes holding it see-through, its
      // overlays (a play button, a caption) left.
      tiles = /** @type {HTMLElement[]} */ ([...row.querySelectorAll('.oc-media-strip--tile')])
      for (const tile of tiles) {
        tile.style.opacity = ''
        const { x, y } = rowOffset(tile)
        const w = tile.offsetWidth
        const h = tile.offsetHeight
        const tileImages = [...tile.querySelectorAll('img')]
        const picture = tileImages.find((img) => loaded(img) && img.offsetWidth >= w - 2 && img.offsetHeight >= h - 2)
        if (picture) slicePicture(picture, tile)
        const seeThrough = tile.classList.contains('oc-media-strip--see-through')
        const translucentCount = tile.querySelectorAll('.oc-media-strip--translucent').length
        // Its copies, cut in slices: each clipped to its strip, its width
        // `widthOf(sx, sw)`, the copy readied by `prepare`.
        const sliceCopies = (widthOf, prepare) => {
          for (let sx = 0; sx < w; sx += sliceWidth) {
            const sw = Math.min(sliceWidth, w - sx)
            const slice = document.createElement('div')
            Object.assign(slice.style, { position: 'absolute', left: `${x + sx}px`, top: `${y}px`, width: `${widthOf(sx, sw)}px`, height: `${h}px`, overflow: 'hidden', backfaceVisibility: 'hidden' })
            const copy = /** @type {HTMLElement} */ (tile.cloneNode(true))
            copy.inert = true
            // Not what the cylinder set on the real one, when it's a column
            // itself (turned, or hidden past a side).
            Object.assign(copy.style, { position: 'absolute', left: `${-sx}px`, top: '0', width: `${w}px`, height: `${h}px`, margin: '0', opacity: '', transform: 'none', visibility: 'visible', pointerEvents: 'none' })
            prepare(copy)
            slice.append(copy)
            stageTrack.append(slice)
            slices.push({ slice, x: x + sx + sw / 2 })
          }
        }
        // Over the next one by SLICE_OVERLAP, no seams between slices - not
        // the last.
        const overlapping = (sx, sw) => (sx + sw >= w ? sw : sw + SLICE_OVERLAP)
        const exact = (sx, sw) => sw
        const translucentOf = (copy) => /** @type {HTMLElement[]} */ ([...copy.querySelectorAll('.oc-media-strip--translucent')])
        if (picture) {
          // Over its picture: in the copies, that image hidden and the boxes
          // holding it see-through.
          const pictureIndex = tileImages.indexOf(picture)
          const overPicture = (copy) => {
            const image = /** @type {HTMLElement} */ (copy.querySelectorAll('img')[pictureIndex])
            image.style.visibility = 'hidden'
            for (let e = image.parentElement; e; e = e === copy ? null : e.parentElement) e.style.background = 'transparent'
          }
          // See-through overlays (a play button's circle) apart, slices
          // meeting edge to edge - overlapping, they'd be drawn twice there,
          // a darker line every slice; only their backgrounds, under the rest.
          if (translucentCount) {
            sliceCopies(exact, (copy) => {
              overPicture(copy)
              copy.style.visibility = 'hidden'
              for (const element of translucentOf(copy)) Object.assign(element.style, { visibility: 'visible', color: 'transparent' })
            })
          }
          // The rest of its overlays (a play button's triangle, a caption),
          // overlapping as the picture's slices: no seams.
          sliceCopies(overlapping, (copy) => {
            overPicture(copy)
            for (const element of translucentOf(copy)) element.style.background = 'transparent'
          })
        } else {
          // When it's see-through, slices meeting edge to edge: an overlap
          // would show a darker seam.
          sliceCopies(seeThrough ? exact : overlapping, () => {})
        }
        tile.style.opacity = '0'
      }
      images = /** @type {HTMLImageElement[]} */ ([...row.querySelectorAll('.oc-media-strip--picture img')])
      for (const img of images) {
        if (!loaded(img)) continue
        slicePicture(img, /** @type {HTMLElement} */ (img.closest('.oc-media-strip--picture')))
        img.style.opacity = '0'
      }
    }

    // Where a point of the flat strip lands on the cylinder: its arc from the
    // middle is its distance on the strip. Flat across the front band, then
    // round on the sides' radius.
    // Forward by as much as makes its front `zoom` times larger.
    const forward = perspective * (1 - 1 / zoom)
    // The sides' radius for a strip of half-width `radius`: `sideRadius`, or
    // filling, as large as takes the sides' far edges (a quarter turn, seen
    // through the perspective) to the strip's edges.
    const bendFor = (radius) => {
      if (!fill) return sideRadius
      const flat = radius * flatShare
      const reach = (bend) => ((flat + bend) * perspective) / (perspective - forward + bend)
      if (reach(sideRadius) >= radius) return sideRadius
      let low = sideRadius
      let high = radius * 20
      if (reach(high) < radius) return high
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2
        if (reach(mid) < radius) low = mid
        else high = mid
      }
      return high
    }
    function place(x, center, radius) {
      const flat = radius * flatShare
      const bend = bendFor(radius)
      const distance = x - center
      const side = Math.sign(distance)
      const theta = Math.max(0, Math.abs(distance) - flat) / bend
      const shift = side * (Math.min(Math.abs(distance), flat) + bend * Math.sin(theta)) + center - x
      const depth = forward + bend * (Math.cos(theta) - 1)
      return { theta, transform: `translate3d(${shift}px, 0, ${depth}px) rotateY(${-side * theta}rad)` }
    }

    // How far from the middle (px, on the screen) a point of the strip shows,
    // `distance` from the middle on the flat strip: bent on the sides, then
    // enlarged by the perspective as `place` sets it.
    function onScreen(distance, radius) {
      const flat = radius * flatShare
      const bend = bendFor(radius)
      const theta = Math.max(0, distance - flat) / bend
      const lateral = Math.min(distance, flat) + bend * Math.sin(theta)
      const depth = forward + bend * (Math.cos(theta) - 1)
      return { theta, offset: (lateral * perspective) / (perspective - depth) }
    }
    // The distance from the middle on the flat strip that shows `target` px
    // from it on the screen - or, past what the sides reach (turned at most
    // ~70°, still facing the reader), the farthest they show.
    function startEdgeDistance(target, radius) {
      let low = 0
      let high = radius * flatShare + bendFor(radius) * 1.2
      if (onScreen(high, radius).offset <= target) return high
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2
        if (onScreen(mid, radius).offset < target) low = mid
        else high = mid
      }
      return low
    }

    let frame
    let stale = true
    function layout() {
      frame = undefined
      const columns = columnsOf()
      if (!columns.length) return
      if (stale) {
        // Room before the first column and after the last, in the reading
        // direction: either can be scrolled to the middle - the strip starts
        // on the first one there.
        const padding = parseFloat(getComputedStyle(row.parentElement).paddingInlineStart) || 0
        const roomBefore = Math.max(0, view.clientWidth / 2 - columns[0].offsetWidth / 2 - padding)
        row.style.marginInlineStart = `${roomBefore}px`
        row.style.marginInlineEnd = `${Math.max(0, view.clientWidth / 2 - columns.at(-1).offsetWidth / 2 - padding)}px`
        // Starting at the start: the first item's start edge where the
        // cylinder shows it at the viewing area's start - or, on a strip wider
        // than the cylinder's sides reach, at their visible edge (flush with
        // the area's edge, it would be past the side, out of sight) - until
        // the reader scrolls (a right-to-left strip scrolls toward negative
        // positions).
        if (holdStart) {
          const half = view.clientWidth / 2
          // 8px in from the edge: the projection's rounding never clips its corner.
          const startLeft = padding + roomBefore - half + Math.max(startEdgeDistance(half - padding - 8, half), columns[0].offsetWidth / 2)
          view.scrollLeft = rtl ? -startLeft : startLeft
        }
        // The row's flat plane is in front of the turned items: it lets the
        // pointer through to them.
        row.style.pointerEvents = 'none'
        for (const column of columns) column.style.pointerEvents = 'auto'
        build()
        // The stage over the viewing area (clipped as it is); its track the
        // row's size, the slices' place in it the row's.
        const rootRect = stage.parentElement.getBoundingClientRect()
        const areaRect = view.getBoundingClientRect()
        Object.assign(stage.style, { left: `${areaRect.left - rootRect.left}px`, top: `${areaRect.top - rootRect.top}px`, width: `${view.clientWidth}px`, height: `${view.clientHeight}px` })
        Object.assign(stageTrack.style, { width: `${row.offsetWidth}px`, height: `${row.offsetHeight}px` })
        stale = false
      }
      const viewRect = view.getBoundingClientRect()
      // No scrolling past the first or the last column in the middle (the
      // turned slices make the strip scroll further than its own width).
      const middle = viewRect.left + view.clientLeft + view.clientWidth / 2
      const firstMiddle = row.getBoundingClientRect().left + columns[0].offsetLeft + columns[0].offsetWidth / 2
      const lastMiddle = row.getBoundingClientRect().left + columns.at(-1).offsetLeft + columns.at(-1).offsetWidth / 2
      // The leftmost and rightmost: the first and the last, or the other way
      // round right to left.
      const leftMiddle = Math.min(firstMiddle, lastMiddle)
      const rightMiddle = Math.max(firstMiddle, lastMiddle)
      const past = Math.min(0, rightMiddle - middle) || Math.max(0, leftMiddle - middle)
      if (Math.abs(past) >= 1) {
        view.scrollLeft += past
      }
      const rowLeft = row.getBoundingClientRect().left
      const center = viewRect.left + view.clientLeft + view.clientWidth / 2 - rowLeft
      const radius = view.clientWidth / 2
      row.style.perspective = `${perspective}px`
      row.style.perspectiveOrigin = `${center}px 50%`
      // The slices follow the row as the strip scrolls - moved here, in the
      // same frame as they're bent, not by the browser's scrolling a frame
      // ahead (a touch swipe's: the cylinder slid sideways, out of shape,
      // until this caught up).
      const rowRect = row.getBoundingClientRect()
      const stageRect = stage.getBoundingClientRect()
      stageTrack.style.transform = `translate(${rowRect.left - stageRect.left}px, ${rowRect.top - stageRect.top}px)`
      stageTrack.style.perspective = `${perspective}px`
      stageTrack.style.perspectiveOrigin = `${center}px 50%`
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

    // Snapping (mandatory) would take a start-aligned strip back to the
    // middle of a column: it waits for the reader's first move, the start
    // held till then - a wheel notch or a key at once (in the capture phase,
    // before the wheel's own handler, which scrolls natively once snapping is
    // on); a press or a touch once let go, so a drag follows the pointer and
    // settles on a column where it ends (switched on during it, the strip
    // would jump to a snap point).
    const rtl = getComputedStyle(view).direction === 'rtl'
    let holdStart = start === 'start'
    const frameElement = view.parentElement
    const atOnce = ['wheel', 'keydown']
    const presses = ['pointerdown', 'touchstart']
    // Not pointercancel: the browser sends it as soon as a touch becomes a
    // pan (or a press a native drag), mid-gesture.
    const letGo = ['pointerup', 'touchend', 'touchcancel', 'dragend']
    function release() {
      holdStart = false
      view.style.scrollSnapType = 'x mandatory'
      stopWaiting()
    }
    let pressedAt = 0
    function pressed() {
      // Held no longer (a drag moves it), snapping not yet.
      holdStart = false
      pressedAt = view.scrollLeft
      presses.forEach((type) => frameElement.removeEventListener(type, pressed, true))
      letGo.forEach((type) => window.addEventListener(type, letGoOf, true))
    }
    // Let go: snapping on if the strip moved; a click (it didn't) leaves it
    // at the start, waiting again.
    function letGoOf() {
      letGo.forEach((type) => window.removeEventListener(type, letGoOf, true))
      if (Math.abs(view.scrollLeft - pressedAt) >= 1) {
        // A swipe: its glide runs its course first (snapping switched on at
        // once would cut it short, the strip jumping to a column), then the
        // strip eases to the nearest column, snapping on once there - and
        // from then on the browser's (a swipe's glide ending on a column).
        holdStart = false
        stopWaiting()
        afterGlide()
        return
      }
      holdStart = true
      presses.forEach((type) => frameElement.addEventListener(type, pressed, { capture: true, passive: true }))
    }
    function stopWaiting() {
      atOnce.forEach((type) => frameElement.removeEventListener(type, release, true))
      presses.forEach((type) => frameElement.removeEventListener(type, pressed, true))
      letGo.forEach((type) => window.removeEventListener(type, letGoOf, true))
    }
    // The scrollbar dragged: snapping off while it's held - on, every position
    // it gives would be pulled to a column, the strip jumping from one to the
    // next - then, let go, a glide to the nearest column, snapping back on
    // once there (switched on at once, the browser would jump to it).
    const track = /** @type {HTMLElement|null} */ (frameElement.querySelector('.oc-scrollbar--track-horizontal'))
    let settleTimer
    function nearestColumnLeft() {
      const viewRect = view.getBoundingClientRect()
      const middle = viewRect.left + view.clientLeft + view.clientWidth / 2
      let best = null
      // The snap guides: each column's flat place (build).
      for (const guide of layer.children) {
        const rect = guide.getBoundingClientRect()
        if (rect.height > 2) continue
        const offset = rect.left + rect.width / 2 - middle
        if (best === null || Math.abs(offset) < Math.abs(best)) best = offset
      }
      return best === null ? view.scrollLeft : view.scrollLeft + best
    }
    function snapOn() {
      clearTimeout(settleTimer)
      view.removeEventListener('scrollend', snapOn)
      view.style.scrollSnapType = 'x mandatory'
    }
    function trackLetGo() {
      window.removeEventListener('pointerup', trackLetGo, true)
      view.addEventListener('scrollend', snapOn)
      // No scrollend in some browsers, or no scroll at all (already there).
      settleTimer = setTimeout(snapOn, 700)
      view.scrollTo({ left: nearestColumnLeft(), behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    // Still for a moment (no scroll for 120ms): the glide is over.
    let glideTimer
    function afterGlide() {
      const still = () => {
        view.removeEventListener('scroll', moving)
        trackLetGo()
      }
      function moving() {
        clearTimeout(glideTimer)
        glideTimer = setTimeout(still, 120)
      }
      view.addEventListener('scroll', moving, { passive: true })
      moving()
      stopGlideWait = () => {
        clearTimeout(glideTimer)
        view.removeEventListener('scroll', moving)
      }
    }
    let stopGlideWait = () => {}
    function trackPressed() {
      // The start held no longer; the drag is the scrollbar's.
      holdStart = false
      stopGlideWait()
      stopWaiting()
      clearTimeout(settleTimer)
      view.style.scrollSnapType = ''
      window.addEventListener('pointerup', trackLetGo, true)
    }
    layout()
    track?.addEventListener('pointerdown', trackPressed)
    if (holdStart) {
      atOnce.forEach((type) => frameElement.addEventListener(type, release, { capture: true, passive: true }))
      presses.forEach((type) => frameElement.addEventListener(type, pressed, { capture: true, passive: true }))
    } else release()
    view.addEventListener('scroll', schedule, { passive: true })
    row.addEventListener('load', onLoad, true)
    const observer = new ResizeObserver(rebuild)
    observer.observe(view)
    observer.observe(row)
    return () => {
      cancelAnimationFrame(frame)
      stopGlideWait()
      stopWaiting()
      clearTimeout(settleTimer)
      track?.removeEventListener('pointerdown', trackPressed)
      window.removeEventListener('pointerup', trackLetGo, true)
      view.removeEventListener('scrollend', snapOn)
      view.style.scrollSnapType = ''
      view.removeEventListener('scroll', schedule)
      row.removeEventListener('load', onLoad, true)
      observer.disconnect()
      layer.replaceChildren()
      stageTrack.replaceChildren()
      for (const img of images) img.style.opacity = ''
      for (const tile of tiles) tile.style.opacity = ''
      for (const column of columnsOf()) {
        column.style.transform = ''
        column.style.visibility = ''
        column.style.pointerEvents = ''
      }
      Object.assign(row.style, { marginInlineStart: '', marginInlineEnd: '', pointerEvents: '' })
    }
  }, [rebuildKey, start, cylinder, sideRadius, flatShare, zoom, perspective, sliceWidth, fill])

  return (
    <Box
      className={`oc-media-strip ${className || ''}`.trim()}
      sx={[(theme) => ({
        // A band of its own tone behind the cylinder, as tall as the items in
        // front (zoomed on the cylinder) - lighter than the pane in dark mode,
        // a faint tint in light mode.
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          // Filling (a page's strip): the whole strip, its scrollbar's room
          // too - no other colour around or between its items.
          ...(fill ? { bottom: 0 } : { height: `calc(${rowHeight} + 2 * ${zoomRoom})` }),
          bgcolor: theme.vars.sys.color.surfaceContainer,
          ...theme.applyStyles('dark', { bgcolor: theme.vars.sys.color.surfaceContainerHighest }),
        },
      }), { position: 'relative', // What follows overlaps the scrollbar's room - not on a filling strip, whose band covers it.
        marginBottom: fill ? 0 : 'calc(var(--oc-pane-padding-block) * -1)', height: fill ? `calc(${rowHeight} + 2 * ${zoomRoom})` : `calc(var(--oc-pane-padding-block) + ${rowHeight} + 2 * ${zoomRoom})` }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {/* The cylinder's slices (filled by its effect): over the viewing area,
          outside its scrolling; under the real items (invisible, there for
          the pointer and the keyboard). */}
      <Box ref={stageRef} className="oc-media-strip--cylinder" aria-hidden sx={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }}>
        <Box ref={trackRef} sx={{ position: 'absolute', left: 0, top: 0 }} />
      </Box>
      <Scrollbars
        ref={scrollbarsRef}
        autoHide
        autoHeight
        autoHeightMax={itemHeight + zoomRoomMax * 2 + 100}
        trackHorizontalProps={{
          style: {
            left: 'calc(var(--oc-pane-padding-inline) / 2)',
            right: 'calc(var(--oc-pane-padding-inline) / 2)',
            // Filling: in its bottom margin (no room of its own under it).
            bottom: fill ? `${Math.max(0, (margin - SCROLLBAR_TRACK_HEIGHT) / 2)}px` : `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)`,
          },
        }}
      >
        <Box onFocus={(event) => centerFocused(event, scrollbarsRef.current?.view)} onKeyDown={leaveOnArrow} sx={{ px: 'var(--oc-pane-padding-inline)', py: zoomRoom, mb: fill ? 0 : 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
          <Box ref={rowRef} className="oc-media-strip--row" sx={{ position: 'relative', width: 'min-content', display: 'flex', flexWrap: 'nowrap', gap: `${gap}px`, transformStyle: 'preserve-3d' }}>
            {children}
            {/* The columns' snap guides (filled by its effect). */}
            <Box ref={sliceLayerRef} className="oc-media-strip--guides" aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          </Box>
        </Box>
      </Scrollbars>
    </Box>
  )
}
