import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer'
import Picture from '@/components/Picture'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

export default function MediaViewer({ media }) {
  const { t } = useTranslation('mediaPane')

  return media.type === 'panorama' ? (
    <PanoViewer src={media.src} />
  ) : (
    // <Picture sources={media.sources} width='100%' height='100%' />
    <PictureViewer media={media} />
  )
}

function PanoViewer({ src }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef) {
      console.log('containerRef: %o', containerRef.current)
      function handler(event) {
        console.log('pointermove: %o', event.bubbles)
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
      />
    </div>
  )
}

function PictureViewer({ media }) {
  return (
    <TransformWrapper
      limitToBounds={false}
    >
      <TransformComponent
        wrapperClass='oc-media-viewer-wrapper'
        contentClass='oc-media-viewer-content'
      >
        <Picture sources={media.sources} width='100%' height='100%' />
      </TransformComponent>
    </TransformWrapper>
  )
}