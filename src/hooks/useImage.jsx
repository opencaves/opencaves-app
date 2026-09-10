import { useEffect, useState } from 'react'

const defaultState = {
  src: undefined,
  status: 'loading'
}

export function useImage(url, crossOrigin) {

  const [state, setState] = useState(defaultState)

  useEffect(() => {

    if (!url) {
      return
    }

    const img = document.createElement('img')

    function onload() {
      setState({ src: img.src, status: 'success' })
    }

    function onerror(error) {
      setState({ src: undefined, status: 'failed', error: `Failed to load image.` })
    }

    img.addEventListener('load', onload)
    img.addEventListener('error', onerror)

    if (crossOrigin) {
      img.crossOrigin = crossOrigin
    }

    img.src = url

    return function cleanup() {
      img.removeEventListener('load', onload)
      img.removeEventListener('error', onerror)
      setState(defaultState)
    }

  }, [url, crossOrigin])

  return { ...state }
}