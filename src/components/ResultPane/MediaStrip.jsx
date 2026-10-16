import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import { centerFocused, leaveOnArrow, reducedMotion, scrollStrip, snapOnSettle } from '@/utils/mediaStrip.js'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import { useHydrated } from '@/hooks/useHydrated.js'

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
// A tile's controls (a menu's button, `.oc-media-strip--live`): drawn in its
// copies, curved with it, the real ones (hidden) taking the pointer - their
// state shown on the copies: the tile hovered (`data-oc-hover` on each
// copy), a menu open (`aria-expanded`).
const LIVE = '.oc-media-strip--live'
// The flat strip for reduced motion. Browser only: effects and handlers
// call it; rendering goes through useHydrated (the server has no window).
// A wheel notch's scroll (px; Chrome's is 100, times the display's scaling):
// what moves the cylinder a column.
const WHEEL_NOTCH = 100
// How far a slice reaches over the next one (px). Each slice is drawn on its
// own, its edges blended with what's behind; half a pixel left that blend
// showing - the band through a thin line every slice. Two cover it (the next
// slice draws over the same picture).
const SLICE_OVERLAP = 2
// How long thumbnails must stop loading before the strip is built again
// with them, in ms (lazy ones arrive one by one: one build, not one each).
const LOADS_SETTLE_MS = 150
// A strip starting at its start: its first item this far in from the
// viewing area's edge (px).
const START_MARGIN = 8
// The space around the cylinder's band, above and below it (px): the
// band's tone, as the band, between the band's curved edges
// and what's around the strip, kept along the curve (bandShape).
const BAND_MARGIN = 8
// The longest a build waits for its slices' images to be decoded before it
// shows them anyway (ms); and the longest the strip stays hidden at first,
// built or not (CSS, so without JavaScript too).
const DECODE_WAIT_MS = 1500
// Decoded (or failed, or too slow): its slices paint at once once shown.
const decoded = (url) => {
  const image = new Image()
  image.src = url
  return image.decode().catch(() => {})
}

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
 * when its background is, so its slices don't overlap; `.oc-media-strip--paper`
 * when its picture may be semi-transparent, a map's, drawn on white; its controls marked
 * `.oc-media-strip--live`, a menu's button, show their hover and open state
 * on the copies: `[data-oc-hover]` on the copy, `[aria-expanded]`). Every item carries
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
  // While rendering: the server's (and hydration's) cylinder, motion allowed,
  // then the browser's setting.
  const hydrated = useHydrated()
  const renderCylinder = cylinder && !(hydrated && reducedMotion())
  const rowHeight = typeof height === 'number' ? `${height}px` : height
  // Above and below the strip: room for the zoomed cylinder - the items'
  // own height's (a CSS length when they're sized by CSS: smaller on a
  // phone), not the largest's.
  // A filling strip (a page's): the gap between its items above and below
  // too, so the zoomed front isn't flush with its band.
  const zoomShare = renderCylinder ? (zoom - 1) / 2 : 0
  // Its band's margin above and below (BAND_MARGIN), with a filling strip's
  // gap.
  const bandMargin = renderCylinder ? BAND_MARGIN : 0
  const margin = (fill ? gap : 0) + bandMargin
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

    // What the shown build made: its slices, the items it hides (the tiles
    // and pictures it slices), the tiles with controls and their copies.
    const state = { slices: [], images: [], tiles: [], copiesOf: new Map() }
    // A tile's hover, on its copies.
    const hoverOf = (on) => (event) => {
      const tile = event.target.closest?.('.oc-media-strip--tile')
      if (!tile || !state.copiesOf.has(tile) || tile.contains(event.relatedTarget)) return
      for (const copy of state.copiesOf.get(tile)) copy.toggleAttribute('data-oc-hover', on)
    }
    const hoverOn = hoverOf(true)
    const hoverOff = hoverOf(false)
    row.addEventListener('pointerover', hoverOn)
    row.addEventListener('pointerout', hoverOff)
    // A control's menu open, on its copies.
    const liveState = new MutationObserver((records) => {
      for (const { target } of records) {
        const element = /** @type {HTMLElement} */ (target)
        const tile = element.matches(LIVE) && element.closest('.oc-media-strip--tile')
        if (!tile || !state.copiesOf.has(tile)) continue
        const index = [...tile.querySelectorAll(LIVE)].indexOf(element)
        const expanded = element.getAttribute('aria-expanded')
        for (const copy of state.copiesOf.get(tile)) {
          const twin = copy.querySelectorAll(LIVE)[index]
          if (expanded == null) twin?.removeAttribute('aria-expanded')
          else twin?.setAttribute('aria-expanded', expanded)
        }
      }
    })
    liveState.observe(row, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
    // Each column's flat place in the row and its width, measured by build
    // (offsets ignore transforms, and scrolling doesn't move them): layout
    // reads these, not the columns, every frame.
    let columnPlaces = []
    // An element's place in the row and its size, read at once (build reads
    // everything before writing anything: a read after a write makes the
    // browser lay the page out again, once per item).
    function measure(element) {
      return { ...rowOffset(element), w: element.offsetWidth, h: element.offsetHeight }
    }
    // The latest build: an older one still decoding gives way to it.
    let builds = 0
    // The strip's first build shown: it was hidden until then (the root's
    // data-oc-building), never seen flat, then half built.
    const root = stage.parentElement
    // The slices made again: off the page, their images decoded, then put in
    // place of the old ones at once, placed in the same step - the strip never
    // blank, nor its items flat, between two builds.
    function build() {
      const build = ++builds
      let slices = []
      const tiles = /** @type {HTMLElement[]} */ ([...row.querySelectorAll('.oc-media-strip--tile')])
      const copiesOf = new Map(tiles.filter((tile) => tile.querySelector(LIVE)).map((tile) => [tile, []]))
      const loaded = (img) => Boolean(img.currentSrc && img.naturalWidth)

      // --- Read: every place, size and style first.
      columnPlaces = columnsOf().map((column) => measure(column))
      const radiusOf = (box) => getComputedStyle(box).borderTopLeftRadius || '.5rem'
      const tilePlans = tiles.map((tile) => {
        const place = measure(tile)
        const tileImages = [...tile.querySelectorAll('img')]
        const picture = tileImages.find((img) => loaded(img) && img.offsetWidth >= place.w - 2 && img.offsetHeight >= place.h - 2)
        return {
          tile,
          place,
          tileImages,
          picture,
          radius: picture ? radiusOf(tile) : null,
          seeThrough: tile.classList.contains('oc-media-strip--see-through'),
          paper: tile.classList.contains('oc-media-strip--paper'),
          translucentCount: tile.querySelectorAll('.oc-media-strip--translucent').length,
        }
      })
      const images = /** @type {HTMLImageElement[]} */ ([...row.querySelectorAll('.oc-media-strip--picture img')])
      const picturePlans = images.filter(loaded).map((img) => {
        const box = /** @type {HTMLElement} */ (img.closest('.oc-media-strip--picture'))
        return { img, place: measure(box), radius: radiusOf(box) }
      })

      // --- Write: the new elements gathered off the page, added at once.
      const guides = document.createDocumentFragment()
      const track = document.createDocumentFragment()
      // CSS scroll snapping on each column's middle. Its snap points are the
      // targets' transformed boxes: the turned columns would shift them, so
      // they're invisible guides at each column's flat place instead.
      for (const { x, w } of columnPlaces) {
        const guide = document.createElement('div')
        Object.assign(guide.style, { position: 'absolute', left: `${x}px`, top: '0', width: `${w}px`, height: '1px', scrollSnapAlign: 'center' })
        guides.append(guide)
      }
      // A picture as slices of its image (as object-fit: cover), filling its
      // box (`place`, measured) - its corners rounded as the box's.
      function slicePicture(img, { x, y, w, h }, radius, paper = false) {
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
        const bw = img.naturalWidth * scale
        const bh = img.naturalHeight * scale
        const count = Math.ceil(w / sliceWidth)
        for (let i = 0; i < count; i++) {
          const sx = i * sliceWidth
          const sw = Math.min(sliceWidth, w - sx)
          const slice = document.createElement('div')
          // Over the next one by SLICE_OVERLAP: no seams between slices (not
          // the last, its corner rounded). A paper tile's on white: a
          // semi-transparent image (a map's thumbnail) drawn twice where
          // slices overlap showed a band at every slice. Only there: under an
          // opaque photo, the white showed at each slice's edge as a line.
          Object.assign(slice.style, {
            ...(paper && { backgroundColor: '#ffffff' }),
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
          track.append(slice)
          slices.push({ slice, x: x + sx + sw / 2 })
        }
      }

      // A tile (a video, a map, "more photos", "add photos"): each slice a
      // copy of it, clipped to its strip - out of reach, the real one under it.
      // Its picture (an image filling it: a video's still, a map's thumbnail)
      // drawn as a photo is, slices of the image itself - copies redrew it a
      // little differently each, thin lines between them; in the copies, over
      // it, that image hidden and the boxes holding it see-through, its
      // overlays (a play button, a caption) left.
      for (const { tile, place, tileImages, picture, radius, seeThrough, paper, translucentCount } of tilePlans) {
        const { x, y, w, h } = place
        if (picture) slicePicture(picture, place, radius, paper)
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
            copiesOf.get(tile)?.push(copy)
            prepare(copy)
            slice.append(copy)
            track.append(slice)
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
          // See-through overlays (a play button's circle, a ⋮ button's dark
          // background) apart, only their backgrounds, under the rest: each
          // in one piece, as wide as it, turned as the cylinder is at its
          // middle - over its few dozen pixels the curve is flat enough. In
          // slices meeting edge to edge, the curve opened hairline gaps
          // between them (white lines over a light map); overlapping, a
          // darker line every slice.
          if (translucentCount) {
            const tileBox = tile.getBoundingClientRect()
            const scaleX = tileBox.width ? tile.offsetWidth / tileBox.width : 1
            ;[.../** @type {NodeListOf<HTMLElement>} */ (tile.querySelectorAll('.oc-media-strip--translucent'))].forEach((element, index) => {
              // Its span across the tile, in whole pixels: its offsets in the
              // tile (a transform doesn't change them), else its box (the
              // tile's own, scaled back to the tile's width).
              let left = 0
              let parent = element
              while (parent && parent !== tile) {
                left += parent.offsetLeft
                parent = /** @type {HTMLElement} */ (parent.offsetParent)
              }
              const box = element.getBoundingClientRect()
              const from = parent === tile ? left : (box.left - tileBox.left) * scaleX
              const to = parent === tile ? left + element.offsetWidth : (box.right - tileBox.left) * scaleX
              const start = Math.max(0, Math.floor(from))
              const end = Math.min(w, Math.ceil(to))
              if (end <= start) return
              const piece = document.createElement('div')
              Object.assign(piece.style, { position: 'absolute', left: `${x + start}px`, top: `${y}px`, width: `${end - start}px`, height: `${h}px`, overflow: 'hidden', backfaceVisibility: 'hidden' })
              const copy = /** @type {HTMLElement} */ (tile.cloneNode(true))
              copy.inert = true
              Object.assign(copy.style, { position: 'absolute', left: `${-start}px`, top: '0', width: `${w}px`, height: `${h}px`, margin: '0', opacity: '', transform: 'none', visibility: 'hidden', pointerEvents: 'none' })
              overPicture(copy)
              // This overlay's background only (the others have their own piece).
              Object.assign(translucentOf(copy)[index].style, { visibility: 'visible', color: 'transparent' })
              copiesOf.get(tile)?.push(copy)
              piece.append(copy)
              track.append(piece)
              slices.push({ slice: piece, x: x + (start + end) / 2 })
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
      }
      for (const { img, place, radius } of picturePlans) slicePicture(img, place, radius)
      // The images the slices show (loaded on the page: in the cache).
      const urls = new Set([...row.querySelectorAll('img')].filter(loaded).map((img) => img.currentSrc))
      const ready = Promise.race([Promise.all([...urls].map(decoded)), new Promise((resolve) => setTimeout(resolve, DECODE_WAIT_MS))])
      ready.then(() => {
        if (build !== builds) return
        // The old build's items shown again (gone, or no longer sliced), the
        // new one's hidden: the slices draw them.
        for (const tile of state.tiles) tile.style.opacity = ''
        for (const img of state.images) img.style.opacity = ''
        for (const { tile } of tilePlans) tile.style.opacity = '0'
        for (const { img } of picturePlans) img.style.opacity = '0'
        layer.replaceChildren(guides)
        stageTrack.replaceChildren(track)
        Object.assign(state, { slices, tiles, images, copiesOf })
        // Placed now, before they're painted.
        cancelAnimationFrame(frame)
        layout()
        // Shown once it draws something (a build before the items have
        // rendered makes no slices).
        if (slices.length) delete root.dataset.ocBuilding
      })
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
    // enlarged by the perspective as `place` sets it - by `scale` (its
    // heights too: the front zoom times larger).
    function onScreen(distance, radius) {
      const flat = radius * flatShare
      const bend = bendFor(radius)
      const theta = Math.max(0, distance - flat) / bend
      const lateral = Math.min(distance, flat) + bend * Math.sin(theta)
      const depth = forward + bend * (Math.cos(theta) - 1)
      const scale = perspective / (perspective - depth)
      return { theta, offset: lateral * scale, scale }
    }

    // The band's outline (the root's ::before, --oc-strip-band-shape), and
    // its frame's (::after, --oc-strip-frame-shape: its margin around it): its
    // top and bottom edges following the cylinder's - the items' top and
    // bottom as the perspective draws them, smaller toward the sides - at
    // the same distance from them as in front. Its place is the viewing
    // area's: worked out on each build (a resize), not on scrolling.
    function bandShape() {
      const band = getComputedStyle(root, '::before')
      const bandHeight = parseFloat(band.height)
      if (!bandHeight) return
      const bandTop = parseFloat(band.top) || 0
      const rootRect = root.getBoundingClientRect()
      const viewRect = view.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      // Ending where the cylinder's stage does (the viewing area's
      // clientWidth, a whole pixel): the strip's own width can have a
      // fraction, and the frame showed a line past the drawing on the right.
      const width = Math.min(rootRect.width, viewRect.left + view.clientLeft + view.clientWidth - rootRect.left)
      const cx = viewRect.left + view.clientLeft + view.clientWidth / 2 - rootRect.left
      const cy = rowRect.top + rowRect.height / 2 - rootRect.top - bandTop
      const half = row.offsetHeight / 2
      const radius = view.clientWidth / 2
      const front = onScreen(0, radius).scale
      const above = cy - half * front
      const below = bandHeight - (cy + half * front)
      // The edges, from the middle out, while the cylinder still widens.
      const reach = Math.max(cx, width - cx)
      const steps = []
      const furthest = radius * flatShare + (bendFor(radius) * Math.PI) / 2
      for (let i = 0; i <= 64; i++) {
        const point = onScreen((furthest * i) / 64, radius)
        if (steps.length && point.offset <= steps.at(-1).offset) break
        steps.push(point)
        if (point.offset >= reach) break
      }
      const top = ({ scale }) => above + half * (front - scale)
      const bottom = ({ scale }) => bandHeight - below - half * (front - scale)
      const at = (x, y) => `${Math.min(width, Math.max(0, x)).toFixed(1)}px ${y.toFixed(1)}px`
      const last = steps.at(-1)
      const points = [
        at(0, top(last)),
        ...[...steps].reverse().map((step) => at(cx - step.offset, top(step))),
        ...steps.map((step) => at(cx + step.offset, top(step))),
        at(width, top(last)),
        at(width, bottom(last)),
        ...[...steps].reverse().map((step) => at(cx + step.offset, bottom(step))),
        ...steps.map((step) => at(cx - step.offset, bottom(step))),
        at(0, bottom(last)),
      ]
      root.style.setProperty('--oc-strip-band-shape', `polygon(${points.join(', ')})`)
      // The frame (::after, from the strip's top): the band's outline
      // widened by its margin (bandTop) above and below.
      const frameHeight = bandHeight + 2 * bandTop
      const frameTop = (step) => bandTop + top(step) - bandTop
      const frameBottom = (step) => bandTop + bottom(step) + bandTop
      const atFrame = (x, y) => `${Math.min(width, Math.max(0, x)).toFixed(1)}px ${Math.min(frameHeight, Math.max(0, y)).toFixed(1)}px`
      const framePoints = [
        atFrame(0, frameTop(last)),
        ...[...steps].reverse().map((step) => atFrame(cx - step.offset, frameTop(step))),
        ...steps.map((step) => atFrame(cx + step.offset, frameTop(step))),
        atFrame(width, frameTop(last)),
        atFrame(width, frameBottom(last)),
        ...[...steps].reverse().map((step) => atFrame(cx + step.offset, frameBottom(step))),
        ...steps.map((step) => atFrame(cx - step.offset, frameBottom(step))),
        atFrame(0, frameBottom(last)),
      ]
      root.style.setProperty('--oc-strip-frame-shape', `polygon(${framePoints.join(', ')})`)
      scrollbarShape(cx, half, front, steps, rootRect)
    }
    // The scrollbar (the library's horizontal track): a ribbon following the
    // gallery's bottom edge - flat in the middle, rising with the cylinder
    // toward the sides - its ends rounded; the thumb, clipped to it, takes
    // the curve as it moves (and the clip keeps the taller track's hit area
    // to the ribbon). Its middle stays where its CSS puts it; the track grows
    // upward by the curve's rise (--oc-strip-scrollbar-rise).
    function scrollbarShape(cx, half, front, steps, rootRect) {
      const track = scrollbarsRef.current?.trackHorizontal
      if (!track) return
      const trackRect = track.getBoundingClientRect()
      const width = trackRect.width
      if (!width) return
      const left = trackRect.left - rootRect.left
      // How far the bottom edge has risen at x (from the root's left), between
      // the steps' offsets from the middle.
      const riseAt = (x) => {
        const distance = Math.abs(x - cx)
        for (let i = 1; i < steps.length; i++) {
          if (steps[i].offset >= distance) {
            const t = (distance - steps[i - 1].offset) / (steps[i].offset - steps[i - 1].offset || 1)
            return half * (front - (steps[i - 1].scale + t * (steps[i].scale - steps[i - 1].scale)))
          }
        }
        return half * (front - steps.at(-1).scale)
      }
      const cap = SCROLLBAR_TRACK_HEIGHT / 2
      const rise = Math.max(riseAt(left + cap), riseAt(left + width - cap))
      ribbon = { track, topAt: (x) => rise - riseAt(left + x) }
      root.style.setProperty('--oc-strip-scrollbar-rise', `${rise.toFixed(1)}px`)
      root.style.setProperty('--oc-strip-scrollbar-shape', ribbonOutline(0, width))
      thumbShape()
    }
    // The ribbon's outline from `from` to `to` (px along the track), its
    // ends rounded, in coordinates starting at `from`.
    let ribbon = null
    function ribbonOutline(from, to) {
      const thick = SCROLLBAR_TRACK_HEIGHT
      const cap = thick / 2
      const { topAt } = ribbon
      const xs = Array.from({ length: 33 }, (_, i) => from + cap + (Math.max(0, to - from - thick) * i) / 32)
      const at = (x, y) => `${(x - from).toFixed(1)}px ${y.toFixed(1)}px`
      // A half circle around an end's middle, from angle to angle + PI.
      const arc = (x, y, start) => Array.from({ length: 7 }, (_, i) => at(x + cap * Math.cos(start + (Math.PI * (i + 1)) / 8), y + cap * Math.sin(start + (Math.PI * (i + 1)) / 8)))
      return `polygon(${[
        ...xs.map((x) => at(x, topAt(x))),
        ...arc(xs.at(-1), topAt(xs.at(-1)) + cap, -Math.PI / 2),
        ...[...xs].reverse().map((x) => at(x, topAt(x) + thick)),
        ...arc(xs[0], topAt(xs[0]) + cap, Math.PI / 2),
      ].join(', ')})`
    }
    // The thumb: the ribbon's piece under it, its ends rounded wherever it
    // is - again once the library has moved it (a scroll).
    function thumbShape() {
      const thumb = scrollbarsRef.current?.thumbHorizontal
      if (!ribbon || !thumb) return
      const trackLeft = ribbon.track.getBoundingClientRect().left
      const box = thumb.getBoundingClientRect()
      if (!box.width) return
      const from = box.left - trackLeft
      thumb.style.clipPath = ribbonOutline(from, from + box.width)
    }
    let thumbFrame
    const onThumbScroll = () => {
      cancelAnimationFrame(thumbFrame)
      thumbFrame = requestAnimationFrame(thumbShape)
    }
    view.addEventListener('scroll', onThumbScroll, { passive: true })
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
          // 8px in from the viewing area's edge (its band's), whatever the
          // padding: a margin the projection's rounding never clips a corner
          // across.
          const startLeft = padding + roomBefore - half + Math.max(startEdgeDistance(half - START_MARGIN, half), columns[0].offsetWidth / 2)
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
        bandShape()
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
      for (const { slice, x } of state.slices) {
        const { theta, transform } = place(x, center, radius)
        // Past the cylinder's sides: out of sight.
        const hidden = Math.abs(theta) > Math.PI / 2
        slice.style.visibility = hidden ? 'hidden' : ''
        if (!hidden) slice.style.transform = transform
      }
      // The real items, turned as their column's middle (its place measured
      // by build: reading it here, after the writes above, would lay the
      // page out again for every column, every frame).
      if (columnPlaces.length !== columns.length) return rebuild()
      columns.forEach((column, index) => {
        const { x, w } = columnPlaces[index]
        const { theta, transform } = place(x + w / 2, center, radius)
        column.style.visibility = Math.abs(theta) > Math.PI / 2 ? 'hidden' : ''
        column.style.transform = transform
      })
    }
    // Built and bent only near the screen (within a screen's height of it):
    // a strip further down the page stays flat until the reader comes near -
    // its build (thousands of slices for a strip of maps) would only slow the
    // page's loading. Set by `nearness`.
    let near = false
    function schedule() {
      if (near) frame ??= requestAnimationFrame(layout)
    }
    function rebuild() {
      stale = true
      schedule()
    }
    // A thumbnail loaded (they're lazy): its slices can be made - not the
    // slices' own copies loading theirs, or it would never end. Once they
    // stop arriving (LOADS_SETTLE_MS), not once each.
    let loadTimer
    function onLoad(event) {
      if (layer.contains(event.target)) return
      clearTimeout(loadTimer)
      loadTimer = setTimeout(rebuild, LOADS_SETTLE_MS)
    }
    const nearness = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting
        if (near) schedule()
      },
      { rootMargin: '100% 0px' },
    )

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
    nearness.observe(view)
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
      clearTimeout(loadTimer)
      nearness.disconnect()
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
      builds++
      for (const img of state.images) img.style.opacity = ''
      for (const tile of state.tiles) tile.style.opacity = ''
      row.removeEventListener('pointerover', hoverOn)
      row.removeEventListener('pointerout', hoverOff)
      liveState.disconnect()
      for (const column of columnsOf()) {
        column.style.transform = ''
        column.style.visibility = ''
        column.style.pointerEvents = ''
      }
      Object.assign(row.style, { marginInlineStart: '', marginInlineEnd: '', pointerEvents: '' })
      root.style.removeProperty('--oc-strip-band-shape')
      root.style.removeProperty('--oc-strip-frame-shape')
      root.style.removeProperty('--oc-strip-scrollbar-rise')
      root.style.removeProperty('--oc-strip-scrollbar-shape')
      view.removeEventListener('scroll', onThumbScroll)
      cancelAnimationFrame(thumbFrame)
      if (scrollbarsRef.current?.thumbHorizontal) scrollbarsRef.current.thumbHorizontal.style.clipPath = ''
    }
  }, [rebuildKey, start, cylinder, sideRadius, flatShare, zoom, perspective, sliceWidth, fill])

  return (
    <Box
      className={`oc-media-strip ${className || ''}`.trim()}
      // Hidden until its cylinder is first built (its effect): never seen
      // flat, then half built.
      data-oc-building={renderCylinder ? '' : undefined}
      sx={[(theme) => ({
        // Its own stacking context: the frame (::after, z-index -1) under
        // the band (::before) and the items.
        isolation: 'isolate',
        // Its content (not its band) hidden while it's first built, then
        // faded in; shown after DECODE_WAIT_MS whatever happens.
        '& > *': { transition: theme.transitions.create('opacity', { duration: theme.sys.motion.duration.standard, easing: theme.sys.motion.easing.standard }) },
        '&[data-oc-building] > *': { opacity: 0, animation: `oc-media-strip-shown 0s ${DECODE_WAIT_MS}ms forwards` },
        '@keyframes oc-media-strip-shown': { to: { opacity: 1 } },
        // A band of its own tone behind the cylinder, as tall as the items in
        // front (zoomed on the cylinder) - lighter than the pane in dark mode,
        // a faint tint in light mode.
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          // In from the strip's top and bottom by its margin (the page's
          // colour there).
          top: bandMargin,
          // Filling (a page's strip): the whole strip, its scrollbar's room
          // too - no other colour around or between its items.
          ...(fill ? { bottom: bandMargin } : { height: `calc(${rowHeight} + 2 * ${zoomRoom} - ${2 * bandMargin}px)` }),
          bgcolor: theme.vars.sys.color.surfaceContainer,
          ...theme.applyStyles('dark', { bgcolor: theme.vars.sys.color.surfaceContainerHighest }),
          // Its top and bottom curved with the cylinder (the effect's
          // bandShape); straight while flat.
          clipPath: 'var(--oc-strip-band-shape, none)',
        },
        // Around the band, its margin (BAND_MARGIN) in the band's own tone -
        // one band over and under the items, whatever is behind the strip (a
        // second tone showed on the pane's cards) - curved as the band, the same
        // below as above: as tall as the band and its margins (not over the
        // scrollbar's room under a pane's strip). Only on the cylinder.
        ...(renderCylinder && {
          '&::after': {
            content: '""',
            position: 'absolute',
            zIndex: -1,
            left: 0,
            right: 0,
            top: 0,
            height: `calc(${rowHeight} + 2 * ${zoomRoom})`,
            bgcolor: theme.vars.sys.color.surfaceContainer,
            ...theme.applyStyles('dark', { bgcolor: theme.vars.sys.color.surfaceContainerHighest }),
            clipPath: 'var(--oc-strip-frame-shape, none)',
          },
        }),
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
            // Curved with the gallery (scrollbarShape): taller by the curve's
            // rise, cut to the ribbon; square corners, the ribbon has its own.
            height: `calc(${SCROLLBAR_TRACK_HEIGHT}px + var(--oc-strip-scrollbar-rise, 0px))`,
            clipPath: 'var(--oc-strip-scrollbar-shape, none)',
            borderRadius: 0,
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
