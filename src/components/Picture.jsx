import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import { useOnline } from '@/hooks/useOnline.jsx'

// A picture that couldn't load offline (not on the device): a cloud icon in
// its place (centred whatever the picture's own display), saying so, instead of an empty box - tried again once back
// online.
function OfflinePlaceholder({ className, style }) {
  const { t } = useTranslation('offline')
  return (
    <Box component="span" role="img" aria-label={t('notOnDevice')} title={t('notOnDevice')} className={['oc-picture--offline', className].filter(Boolean).join(' ')} style={{ ...style, display: 'grid', placeItems: 'center' }} sx={{ width: '100%', height: '100%', bgcolor: 'action.hover', color: 'text.secondary' }}>
      <CloudOffRounded />
    </Box>
  )
}

/**
 * An image (a <picture> when it has sources), loaded with CORS so the service
 * worker caches it at its real size; one that couldn't load offline shows a
 * cloud icon instead.
 *
 * @param {import('react').ImgHTMLAttributes<HTMLImageElement> & { sources?: { srcSet?: string, media?: string, type?: string }[] }} props - The
 *   <img>'s, and the <picture>'s `sources`.
 */
export default function Picture({ sources, ...props }) {
  const pictureRef = useRef(null)
  const online = useOnline()
  const [missingOffline, setMissingOffline] = useState(false)
  useEffect(() => {
    if (online) setMissingOffline(false)
  }, [online])

  function renderSources() {
    if (sources == null) {
      return null
    }

    const mappedSources = sources.map(({ srcSet, media, type }, index) => {
      if (srcSet == null) {
        return null
      }

      return <source key={`sources-${index}`} srcSet={srcSet} media={media} type={type} />
    })

    return mappedSources
  }

  function renderImage(skipSizes = false) {
    // crossOrigin: cave pictures come from the Storage bucket (CORS-enabled,
    // see storage.cors.json), and a CORS response is cached by the service
    // worker at its real size instead of as a quota-heavy opaque response.
    // draggable: false - a mouse drag on a gallery picture isn't dragging the
    // picture out (it set off the "drop to add" prompt).
    const { alt = '', src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', sizes, className, crossOrigin = 'anonymous', draggable = false, onError, ...rest } = props

    // Adds sizes props if sources isn't defined
    const sizesProp = skipSizes ? null : { sizes }

    const handleError = (event) => {
      if (!navigator.onLine) setMissingOffline(true)
      onError?.(event)
    }
    return <img alt={alt} srcSet={src} crossOrigin={crossOrigin} draggable={draggable} className={`oc-picture--img ${className || ''}`.trim()} onError={handleError} {...sizesProp} {...rest} />
  }

  useEffect(() => {
    if (pictureRef && pictureRef.current) {
      pictureRef.current.naturalWidth = 3072
      pictureRef.current.naturalHeight = 1728
    }
  }, [pictureRef])

  if (missingOffline) return <OfflinePlaceholder className={props.className} style={props.style} />

  if (sources) {
    return (
      <picture ref={pictureRef} className={`oc-picture ${props.className || ''}`.trim()} style={{ display: 'flex' }}>
        {renderSources()}
        {renderImage(true)}
      </picture>
    )
  }

  return renderImage()
}
