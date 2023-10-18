import pixel from '@/images/pixel.gif'
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

      return (
        <source
          key={`sources-${index}`}
          srcSet={srcSet}
          media={media}
          type={type}
        />
      )
    })

    return mappedSources
  }

  function renderImage(skipSizes = false) {
    const {
      alt = '',
      // src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
      src = pixel,
      sizes,
      ...rest
    } = props

    // Adds sizes props if sources isn't defined
    const sizesProp = skipSizes ? null : { sizes }

    return <img alt={alt} srcSet={src} {...sizesProp} {...rest} />
  }

  useEffect(() => {
    if (pictureRef && pictureRef.current) {
      pictureRef.current.naturalWidth = 3072
      pictureRef.current.naturalHeight = 1728
    }
  }, [pictureRef])

  if (sources) {
    return (
      <picture ref={pictureRef} style={{ display: 'flex' }}>
        {renderSources()}
        {renderImage(true)}
      </picture>
    )
  }

  return renderImage()
}
