import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// The lightbox's own labels (its buttons' names, its regions), keyed by its
// English text (yet-another-react-lightbox's `labels`): in the app's language.
const KEYS = {
  Previous: 'previous',
  Next: 'next',
  Close: 'close',
  Share: 'share',
  Download: 'download',
  'Enter Fullscreen': 'enterFullscreen',
  'Exit Fullscreen': 'exitFullscreen',
  'Zoom in': 'zoomIn',
  'Zoom out': 'zoomOut',
  Slide: 'slide',
  Carousel: 'carousel',
  Lightbox: 'lightbox',
  'Photo gallery': 'gallery',
  '{index} of {total}': 'position',
}

export function useLightboxLabels() {
  const { t, i18n } = useTranslation('lightbox')
  return useMemo(
    () => Object.fromEntries(Object.entries(KEYS).map(([label, key]) => [label, t(key)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.resolvedLanguage],
  )
}
