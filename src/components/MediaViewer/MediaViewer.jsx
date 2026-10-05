import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import Picture from '@/components/Picture.jsx'
import { registerPanoramaViewer } from './panoramaViews.js'

export default function MediaViewer({ media }) {
  const { t } = useTranslation('mediaPane')

  return media.type === 'panorama' ? (
    <PanoViewer src={media.src} mediaId={media.mediaId} />
  ) : (
    // <Picture sources={media.sources} width='100%' height='100%' />
    <PictureViewer media={media} />
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

// The photo fills the pane, fitted inside it (object-fit: contain): centred
// whatever its shape or the window's - the zoom content is the whole pane.
function PictureViewer({ media }) {
  return (
    <TransformWrapper limitToBounds={true} wheel={{ step: WHEEL_ZOOM_STEP }}>
      <TransformComponent
        wrapperClass='oc-media-viewer oc-media-viewer-wrapper'
        contentClass='oc-media-viewer-content'
        wrapperStyle={{ width: '100%', height: '100%' }}
        contentStyle={{ width: '100%', height: '100%' }}
      >
        <Picture sources={media.sources} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </TransformComponent>
    </TransformWrapper>
  )
}
