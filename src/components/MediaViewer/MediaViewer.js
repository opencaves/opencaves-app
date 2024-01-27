import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import Picture from '@/components/Picture'

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
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }

  const initialY = (window.innerHeight / 2)

  function onInit(reactZoomPanPinchRef) {
    console.log('[onInit] reactZoomPanPinchRef: %o', reactZoomPanPinchRef)
    // reactZoomPanPinchRef.centerView(1, 0)
    reactZoomPanPinchRef.setTransform(0, 200, 1)
  }

  return (
    <TransformWrapper
      onInit={onInit}
      limitToBounds={true}
    // initialPositionY={initialY}
    >
      <TransformComponent
        wrapperClass='oc-media-viewer-wrapper'
        contentClass='oc-media-viewer-content'
        wrapperStyle={{
          width: '100%',
          height: '100%',
        }}
      >
        <Picture sources={media.sources} width='100%' height='100%' />
      </TransformComponent>
    </TransformWrapper>
  )
}