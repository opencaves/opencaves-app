import { useLayoutEffect, useState } from 'react'

/**
 * The height that takes an element from where it starts down to the bottom
 * of the page - the viewport, less the page container's own bottom padding
 * and border (Layout's <main>) - so a loading skeleton fills the page rather
 * than stopping short. null when disabled or not measured yet.
 *
 * @param {React.RefObject} ref
 * @param {boolean} [enabled=true]
 * @returns {number|null}
 */
export function useFillHeight(ref, enabled = true) {
  const [height, setHeight] = useState(null)

  useLayoutEffect(() => {
    if (!enabled) return undefined
    function measure() {
      const el = ref.current
      if (!el) return
      const main = el.closest('main')
      const style = main ? window.getComputedStyle(main) : null
      const bottomGap = style ? parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth) : 0
      setHeight(Math.max(0, Math.floor(window.innerHeight - el.getBoundingClientRect().top - bottomGap)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref, enabled])

  return height
}
