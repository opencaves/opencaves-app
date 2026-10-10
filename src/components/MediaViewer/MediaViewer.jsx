import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import Picture from '@/components/Picture.jsx'
import { registerPanoramaViewer } from './panoramaViews.js'

/**
 * @param {object} props
 * @param {(locked: boolean) => void} [props.onSwipeLock] - Whether the gallery's carousel must leave swipes alone
 *   (the photo zoomed in, or a pinch under way) - {@link PictureViewer}.
 */
export default function MediaViewer({ media, onSwipeLock }) {
  const { t } = useTranslation('mediaPane')

  return media.type === 'panorama' ? (
    <PanoViewer src={media.src} mediaId={media.mediaId} />
  ) : (
    // <Picture sources={media.sources} width='100%' height='100%' />
    <PictureViewer media={media} onSwipeLock={onSwipeLock} />
  )
}

function PanoViewer({ src, mediaId }) {
  const containerRef = useRef(null)
  const unregister = useRef(null)

  // Known to the media menu, which can take its view as the thumbnail.
  function onReady(viewer) {
    unregister.current?.()
    unregister.current = registerPanoramaViewer(mediaId, viewer)
  }
  useEffect(() => () => unregister.current?.(), [])

  useEffect(() => {
    if (containerRef) {
      function handler(event) {
        event.stopPropagation()
      }

      containerRef.current.addEventListener('pointermove', handler)

      return () => {
        containerRef?.current?.removeEventListener('pointermove', handler)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="oc-media-viewer"
      style={{
        width: '100%',
        height: '100%'
      }}
    >
      <ReactPhotoSphereViewer
        src={src}
        height='100%'
        width='100%'
        navbar='zoom'
        // The drawing kept, so the view can be read off the canvas.
        rendererParameters={{ preserveDrawingBuffer: true }}
        onReady={onReady}
      />
    </div>
  )
}

// Wheel zoom per unit of wheel delta (a mouse notch is ~100): about +0.25 a
// notch - the library's default (0.015) zoomed in by 1.5 a notch.
const WHEEL_ZOOM_STEP = 0.0025
// A double tap or click zooms in a step (x2) on the point tapped, up to the
// largest zoom, where it does nothing (pinching zooms back out). Two taps
// count as one double tap within this time and distance (the library's own
// allowed 200ms, missing most double taps, and zoomed back out by a step it
// barely undid).
const DOUBLE_TAP_STEP = 2
const MAX_ZOOM = 8
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 30
const DOUBLE_TAP_ANIMATION_MS = 250

// The photo fills the pane, fitted inside it (object-fit: contain): centred
// whatever its shape or the window's - the zoom content is the whole pane.
// At zoom 1 it doesn't move: no dragging (a swipe goes to the gallery's
// carousel instead), and never past its edges (no elastic padding) once
// zoomed in.
//
// While zoomed in, or pinching, the gallery's carousel ignores swipes
// (onSwipeLock): a pinch reaching its largest or smallest zoom otherwise
// carried on as a swipe and changed slide. The lock lasts until every finger
// is up, so a pinch ending at zoom 1 can't turn into one either.
function PictureViewer({ media, onSwipeLock }) {
  const [zoomed, setZoomed] = useState(false)
  const pinching = useRef(false)
  const transform = useRef(null)
  const lastTap = useRef(null)

  // Zooms in a step on the point (x, y) in the wrapper - kept still on
  // screen, within the picture's bounds; nothing at the largest zoom.
  function zoomInStep(x, y) {
    const zoom = transform.current
    if (!zoom) return
    const { scale, positionX, positionY } = zoom.instance.state
    if (scale >= MAX_ZOOM - 0.001) return
    const next = Math.min(MAX_ZOOM, scale * DOUBLE_TAP_STEP)
    const { width, height } = zoom.instance.wrapperComponent.getBoundingClientRect()
    const clamp = (value, size) => Math.min(0, Math.max(size * (1 - next), value))
    // The content point under (x, y) stays under it.
    const at = (point, position) => point - ((point - position) * next) / scale
    zoom.setTransform(clamp(at(x, positionX), width), clamp(at(y, positionY), height), next, DOUBLE_TAP_ANIMATION_MS, 'easeOut')
  }
  const pointIn = (event) => {
    const box = transform.current?.instance.wrapperComponent?.getBoundingClientRect()
    return box ? [event.clientX - box.left, event.clientY - box.top] : [0, 0]
  }
  // Touch: two taps close in time and place (a tap: one finger, released
  // where it went down).
  const tapStart = useRef(null)
  function onPointerDown(event) {
    if (event.pointerType === 'touch' && event.isPrimary) tapStart.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
  }
  function onPointerUp(event) {
    const start = tapStart.current
    tapStart.current = null
    if (event.pointerType !== 'touch' || !start || pinching.current) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10 || event.timeStamp - start.t > DOUBLE_TAP_MS) return
    const last = lastTap.current
    if (last && event.timeStamp - last.t < DOUBLE_TAP_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_PX) {
      lastTap.current = null
      zoomInStep(...pointIn(event))
    } else {
      lastTap.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    }
  }
  const lock = (locked) => onSwipeLock?.(locked)
  useEffect(() => () => onSwipeLock?.(false), [onSwipeLock])
  function onTouchEnd(event) {
    if (event.touches.length > 0 || !pinching.current) return
    pinching.current = false
    lock(zoomed)
  }
  return (
    <div
      style={{ width: '100%', height: '100%' }}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onDoubleClick={(event) => zoomInStep(...pointIn(event))}
    >
    <TransformWrapper
      ref={transform}
      limitToBounds={true}
      disablePadding={true}
      maxScale={MAX_ZOOM}
      panning={{ disabled: !zoomed }}
      onTransform={(_ref, { scale }) => {
        const next = scale > 1.001
        setZoomed(next)
        if (!pinching.current) lock(next)
      }}
      onPinchStart={() => {
        pinching.current = true
        lock(true)
      }}
      wheel={{ step: WHEEL_ZOOM_STEP }}
      // Double tap and click are ours (zoomInStep).
      doubleClick={{ disabled: true }}
    >
      <TransformComponent
        wrapperClass='oc-media-viewer oc-media-viewer-wrapper'
        contentClass='oc-media-viewer-content'
        wrapperStyle={{ width: '100%', height: '100%' }}
        contentStyle={{ width: '100%', height: '100%' }}
      >
        <Picture sources={media.sources} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </TransformComponent>
    </TransformWrapper>
    </div>
  )
}
