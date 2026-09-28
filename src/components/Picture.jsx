import { useEffect, useRef } from 'react'

export default function Picture({ sources, ...props }) {
  const pictureRef = useRef()

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
    const { alt = '', src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', sizes, className, crossOrigin = 'anonymous', ...rest } = props

    // Adds sizes props if sources isn't defined
    const sizesProp = skipSizes ? null : { sizes }

    return <img alt={alt} srcSet={src} crossOrigin={crossOrigin} className={`oc-picture--img ${className || ''}`.trim()} {...sizesProp} {...rest} />
  }

  useEffect(() => {
    if (pictureRef && pictureRef.current) {
      pictureRef.current.naturalWidth = 3072
      pictureRef.current.naturalHeight = 1728
    }
  }, [pictureRef])

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
