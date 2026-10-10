import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@mui/material'

/**
 * The map's location button is Mapbox's own (GeolocateControl), labelled with
 * a native title in English. This gives it the map's other buttons' tooltip
 * (MUI, to its left) and a translated label: its title removed - again
 * whenever Mapbox sets it back -, aria-label set.
 *
 * @param {object} props
 * @param {HTMLElement} props.mapContainer - The map's
 *   element, where the control appears once the map has loaded.
 */
export default function GeolocateTooltip({ mapContainer }) {
  const { t } = useTranslation('map')
  const label = t('geolocate.findMyLocation')
  const [button, setButton] = useState(null)
  const [open, setOpen] = useState(false)

  // The button, once Mapbox has added it.
  useEffect(() => {
    if (!mapContainer) return undefined
    const find = () => {
      const found = mapContainer.querySelector('.mapboxgl-ctrl-geolocate')
      if (found) setButton(found)
      return found
    }
    if (find()) return undefined
    const observer = new MutationObserver(() => find() && observer.disconnect())
    observer.observe(mapContainer, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [mapContainer])

  // Its label: ours, and no native tooltip.
  useEffect(() => {
    if (!button) return undefined
    const relabel = () => {
      if (button.hasAttribute('title')) button.removeAttribute('title')
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label)
    }
    relabel()
    const observer = new MutationObserver(relabel)
    observer.observe(button, { attributes: true, attributeFilter: ['title', 'aria-label'] })
    const show = () => setOpen(true)
    const hide = () => setOpen(false)
    // Keyboard focus only (a click's focus would leave it open).
    const onFocus = () => button.matches(':focus-visible') && show()
    button.addEventListener('mouseenter', show)
    button.addEventListener('mouseleave', hide)
    button.addEventListener('focus', onFocus)
    button.addEventListener('blur', hide)
    button.addEventListener('click', hide)
    return () => {
      observer.disconnect()
      button.removeEventListener('mouseenter', show)
      button.removeEventListener('mouseleave', hide)
      button.removeEventListener('focus', onFocus)
      button.removeEventListener('blur', hide)
      button.removeEventListener('click', hide)
    }
  }, [button, label])

  if (!button) return null
  return (
    <Tooltip className="oc-geolocate-tooltip" title={label} placement="left" open={open} disableHoverListener disableFocusListener disableTouchListener slotProps={{ popper: { anchorEl: button } }}>
      <span hidden />
    </Tooltip>
  )
}
