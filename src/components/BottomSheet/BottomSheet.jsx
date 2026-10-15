import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useTheme } from '@mui/material'
import { useSheetDrag } from './useSheetDrag.js'
import './BottomSheet.scss'

// M3's standard decelerate easing (cubic-bezier(0, 0, 0, 1)), near enough:
// the sheet settles quickly, then eases into place.
const easeOut = (t) => 1 - Math.pow(1 - t, 4)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * @typedef {object} BottomSheetHandle
 * @property {(point: number) => Promise<void>} setSnap - Moves the sheet to this snap point, resolving once there.
 * @property {() => number} getSnap - The snap point it rests at (or last rested at, while moving).
 */

/**
 * A non-modal bottom sheet (the map stays usable around it) resting at snap
 * points - fractions of its height shown, the last one (1) its full height.
 * Dragged with the pointer from anywhere on it (useSheetDrag: a flick goes on
 * to the next point that way); at the top snap point its content scrolls,
 * and dragging down content scrolled to its top brings the sheet down. Its
 * handle is a button cycling the snap points (Enter, Space; the arrow keys
 * step up and down). Its position is reported at every frame
 * (`onPositionChange`), so what follows it needs no polling. Sized with CSS
 * (`100dvh` less `--oc-bottom-sheet-top`), never window.innerHeight; its
 * surface, radius and top offset come from `--oc-bottom-sheet-*` variables.
 *
 * @param {object} props
 * @param {React.Ref<BottomSheetHandle>} [props.ref] - The imperative handle ({@link BottomSheetHandle}).
 * @param {number[]} props.snapPoints - The snap points, ascending, fractions of the sheet's height (1: full height).
 * @param {number} props.initialSnap - The snap point it opens at.
 * @param {string} props.label - Names the sheet (a region) for assistive tech.
 * @param {string} props.expandLabel - The handle's name while it raises the sheet.
 * @param {string} props.collapseLabel - The handle's name at the top, where it lowers it.
 * @param {(position: number, height: number) => void} [props.onPositionChange] - Every move: the position (a fraction of the sheet's height) and the height shown, px.
 * @param {(point: number) => void} [props.onSnapChange] - It came to rest at another snap point.
 * @param {string} [props.className]
 * @param {React.CSSProperties} [props.style]
 * @param {React.ReactNode} props.children
 * @param {React.FocusEventHandler<HTMLElement>} [props.onFocus] - Focus moving into the sheet.
 * @param {string} [props.id] - The other props go to the sheet's element.
 */
export default function BottomSheet({ ref, snapPoints, initialSnap, label, expandLabel, collapseLabel, onPositionChange, onSnapChange, className, style, children, ...props }) {
  const theme = useTheme()
  const sheetRef = useRef(/** @type {HTMLElement} */ (null))
  const position = useRef(initialSnap)
  const height = useRef(0)
  const snapRef = useRef(initialSnap)
  const [snap, setSnapState] = useState(initialSnap)
  const animation = useRef(/** @type {{ frame: number, resolve: () => void } | null} */ (null))
  const callbacks = useRef({ onPositionChange, onSnapChange })
  callbacks.current = { onPositionChange, onSnapChange }
  const top = snapPoints[snapPoints.length - 1]

  // The sheet at a position: moved by a transform (no layout), reported.
  const apply = useCallback((value) => {
    position.current = value
    if (sheetRef.current) sheetRef.current.style.transform = `translate3d(0, ${(1 - value) * 100}%, 0)`
    callbacks.current.onPositionChange?.(value, value * height.current)
  }, [])

  const stop = useCallback(() => {
    if (!animation.current) return
    cancelAnimationFrame(animation.current.frame)
    animation.current.resolve()
    animation.current = null
  }, [])

  // To a snap point: eased, or at once with reduced motion.
  const settle = useCallback(
    (target) => {
      stop()
      return new Promise((resolve) => {
        const from = position.current
        const done = () => {
          animation.current = null
          apply(target)
          if (snapRef.current !== target) {
            snapRef.current = target
            setSnapState(target)
            callbacks.current.onSnapChange?.(target)
          }
          resolve()
        }
        if (reducedMotion() || Math.abs(from - target) < 0.001) {
          done()
          return
        }
        const duration = theme.sys.motion.duration.standard
        const start = performance.now()
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration)
          apply(from + (target - from) * easeOut(t))
          if (t < 1) animation.current.frame = requestAnimationFrame(step)
          else done()
        }
        animation.current = { frame: requestAnimationFrame(step), resolve: () => resolve() }
      })
    },
    [apply, stop, theme],
  )

  useImperativeHandle(ref, () => ({ setSnap: settle, getSnap: () => snapRef.current }), [settle])

  // Its height, for the drag's pixels and the height reported: measured
  // before the first paint, and again whenever it changes (the viewport's
  // dynamic height, the phone turned).
  useLayoutEffect(() => {
    const sheet = sheetRef.current
    height.current = sheet.offsetHeight
    apply(position.current)
    const observer = new ResizeObserver(() => {
      height.current = sheet.offsetHeight
      apply(position.current)
    })
    observer.observe(sheet)
    return () => {
      observer.disconnect()
      stop()
    }
  }, [apply, stop])

  useSheetDrag({
    sheetRef,
    getHeight: () => height.current || 1,
    getPosition: () => position.current,
    atTop: () => snapRef.current === top && !animation.current,
    snapPoints,
    onDragStart: stop,
    onDrag: apply,
    onRelease: settle,
  })

  // The handle: up to the next snap point, from the top back to the lowest
  // (as Ionic's handleBehavior="cycle"); arrow keys, one step up or down.
  const index = snapPoints.indexOf(snap)
  function onHandleClick() {
    settle(snap === top ? snapPoints[0] : snapPoints[index + 1] ?? top)
  }
  function onHandleKeyDown(event) {
    const next = event.key === 'ArrowUp' ? snapPoints[index + 1] : event.key === 'ArrowDown' ? snapPoints[index - 1] : undefined
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    if (next !== undefined) settle(next)
  }

  // At the top snap point (oc-bottom-sheet--top) the content scrolls; below
  // it vertical moves are the sheet's (touch-action: pan-x). The transform
  // is the current position: re-rendered mid-move, it stays where it is.
  return (
    <section {...props} ref={sheetRef} aria-label={label} className={`oc-bottom-sheet${snap === top ? ' oc-bottom-sheet--top' : ''}${className ? ` ${className}` : ''}`} style={{ ...style, transform: `translate3d(0, ${(1 - position.current) * 100}%, 0)` }}>
      <button type="button" className="oc-bottom-sheet--handle" aria-label={snap === top ? collapseLabel : expandLabel} onClick={onHandleClick} onKeyDown={onHandleKeyDown} />
      <div className="oc-bottom-sheet--content">{children}</div>
    </section>
  )
}
