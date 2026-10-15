import { useEffect, useRef } from 'react'

// Past this many pixels a press is a drag (the click it would have been is
// dropped), and a mouse starts dragging (a finger at once: see decide()).
const DRAG_SLOP = 6
// A release faster than this (px/ms) is a flick: on to the next snap point
// that way, rather than the nearest one.
const FLICK_VELOCITY = 0.4
// The pointer's last moves the flick's speed is measured over (ms).
const VELOCITY_WINDOW = 100

/**
 * Where a released sheet settles: on a flick (faster than
 * {@link FLICK_VELOCITY}), the next snap point in its direction - the last one
 * that way if it's already past it - else the nearest one.
 *
 * @param {number} position - The sheet's position at release (a fraction of its height shown).
 * @param {number} velocity - The pointer's speed at release, px/ms, positive downwards.
 * @param {number[]} snapPoints - The snap points, ascending.
 * @returns {number}
 */
export function snapTarget(position, velocity, snapPoints) {
  if (velocity < -FLICK_VELOCITY) return snapPoints.find((point) => point > position + 0.01) ?? snapPoints[snapPoints.length - 1]
  if (velocity > FLICK_VELOCITY) return [...snapPoints].reverse().find((point) => point < position - 0.01) ?? snapPoints[0]
  return snapPoints.reduce((nearest, point) => (Math.abs(point - position) < Math.abs(nearest - position) ? point : nearest))
}

// The element under the pointer that scrolls vertically, up to the sheet: the
// one the content's own scrolling would move.
function scrollerOf(target, sheet) {
  for (let element = target; element && element !== sheet; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element)
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) return element
  }
  return null
}

/**
 * Drags a bottom sheet with pointer events: a vertical press-and-move on the
 * sheet moves it ({@link snapTarget} picks where it settles on release),
 * except where the content scrolls instead - at the top snap point (`atTop`),
 * moving up, or down in content not scrolled to its top. Horizontal moves are
 * left to the content (strips, tabs). Touch moves the sheet takes are kept
 * from the browser (a non-passive touchmove), so it neither scrolls nor
 * cancels the pointer.
 *
 * @param {object} options
 * @param {React.RefObject<HTMLElement>} options.sheetRef - The sheet.
 * @param {() => number} options.getHeight - The sheet's full height, px.
 * @param {() => number} options.getPosition - Its position (a fraction of its height shown).
 * @param {() => boolean} options.atTop - Whether it rests at its top snap point (the content scrolls there).
 * @param {number[]} options.snapPoints - The snap points, ascending.
 * @param {() => void} options.onDragStart - A drag begins (stop any animation).
 * @param {(position: number) => void} options.onDrag - The sheet follows the pointer, to this position.
 * @param {(position: number) => void} options.onRelease - The drag ended: settle at this snap point.
 */
export function useSheetDrag({ sheetRef, getHeight, getPosition, atTop, snapPoints, onDragStart, onDrag, onRelease }) {
  // The latest callbacks, for the listeners attached once.
  const options = useRef({ getHeight, getPosition, atTop, snapPoints, onDragStart, onDrag, onRelease })
  options.current = { getHeight, getPosition, atTop, snapPoints, onDragStart, onDrag, onRelease }

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return undefined
    /** @type {{ id: number, x: number, y: number, touch: boolean, startPosition: number, scroller: HTMLElement | null, decided: 'sheet' | 'content' | null, dragging: boolean, moved: boolean, samples: { t: number, y: number }[] } | null} */
    let gesture = null

    // Whether a move (dx, dy from the press) is the sheet's or the content's.
    function decide(dx, dy) {
      if (Math.abs(dx) > Math.abs(dy)) return 'content'
      if (!options.current.atTop()) return 'sheet'
      // At the top: the content scrolls, unless it's at its own top and the
      // move is downwards - the sheet comes down.
      if (dy <= 0 || (gesture.scroller && gesture.scroller.scrollTop > 0)) return 'content'
      return 'sheet'
    }

    function begin(event) {
      gesture.dragging = true
      gesture.startPosition = options.current.getPosition()
      options.current.onDragStart()
      try {
        sheet.setPointerCapture(gesture.id)
      } catch {
        // Already released (the pointer gone): the drag ends with it.
      }
      if (!gesture.touch) window.getSelection()?.removeAllRanges()
      gesture.y = event.clientY
    }

    function move(clientY) {
      const { getHeight, snapPoints, onDrag } = options.current
      const position = gesture.startPosition - (clientY - gesture.y) / getHeight()
      onDrag(Math.min(Math.max(position, snapPoints[0]), snapPoints[snapPoints.length - 1]))
      const t = performance.now()
      gesture.samples.push({ t, y: clientY })
      while (gesture.samples.length > 2 && t - gesture.samples[0].t > VELOCITY_WINDOW) gesture.samples.shift()
    }

    function onPointerDown(event) {
      if (gesture?.dragging || (event.pointerType === 'mouse' && event.button !== 0)) return
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse', startPosition: 0, scroller: scrollerOf(event.target, sheet), decided: null, dragging: false, moved: false, samples: [] }
    }

    function onPointerMove(event) {
      if (!gesture || event.pointerId !== gesture.id) return
      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y
      if (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP) gesture.moved = true
      if (!gesture.decided) {
        // A finger is decided on its first move (the browser decides whether
        // to scroll then); a mouse past the slop, so a click stays a click.
        if (gesture.touch ? dx === 0 && dy === 0 : !gesture.moved) return
        gesture.decided = decide(dx, dy)
      }
      if (gesture.decided !== 'sheet') return
      if (!gesture.dragging) begin(event)
      move(event.clientY)
    }

    // Touch: the moves the sheet takes are kept from the browser's
    // scrolling (pointer events alone can't: a scroll cancels the pointer).
    function onTouchMove(event) {
      if (!gesture || !gesture.touch) return
      const touch = event.touches[0]
      if (!gesture.decided && touch) {
        const dx = touch.clientX - gesture.x
        const dy = touch.clientY - gesture.y
        if (dx !== 0 || dy !== 0) gesture.decided = decide(dx, dy)
      }
      if (gesture.decided === 'sheet' && event.cancelable) event.preventDefault()
    }

    function onPointerEnd(event) {
      if (!gesture || event.pointerId !== gesture.id) return
      const { dragging, moved, samples } = gesture
      gesture = null
      if (!dragging) return
      const first = samples[0]
      const last = samples[samples.length - 1]
      const age = performance.now() - (last?.t ?? 0)
      // A finger that stopped before lifting: no flick.
      const velocity = first && last && last.t > first.t && age < VELOCITY_WINDOW ? (last.y - first.y) / (last.t - first.t) : 0
      const { getPosition, snapPoints, onRelease } = options.current
      onRelease(snapTarget(getPosition(), event.type === 'pointercancel' ? 0 : velocity, snapPoints))
      // The drag isn't also a click on what it started on.
      if (moved) {
        const swallow = (click) => {
          click.stopPropagation()
          click.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      }
    }

    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('pointermove', onPointerMove)
    sheet.addEventListener('pointerup', onPointerEnd)
    sheet.addEventListener('pointercancel', onPointerEnd)
    sheet.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('pointermove', onPointerMove)
      sheet.removeEventListener('pointerup', onPointerEnd)
      sheet.removeEventListener('pointercancel', onPointerEnd)
      sheet.removeEventListener('touchmove', onTouchMove)
    }
  }, [sheetRef])
}
