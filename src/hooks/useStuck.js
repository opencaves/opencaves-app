import { useEffect, useState } from 'react'
import { findScrollParent } from '@/utils/scrollParent.js'

/**
 * Whether a sticky element is stuck (scrolled to its `top` and held there)
 * rather than at its place in the page: its scroller has scrolled and the
 * element sits at its sticky offset. False until measured (an effect), so the
 * server's render and the first browser render are the unstuck one. Checked
 * on the scroller's scroll and on resize, once a frame.
 *
 * @param {import('react').RefObject<HTMLElement>} ref - The sticky element.
 * @param {boolean} [enabled=true] - Off (not sticky now, e.g. on phones): never stuck.
 * @returns {boolean}
 */
export function useStuck(ref, enabled = true) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) {
      setStuck(false)
      return undefined
    }
    const scrollParent = findScrollParent(element)
    let frame
    function update() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // Not sticky at this width (a media query): never stuck.
        if (window.getComputedStyle(element).position !== 'sticky') return setStuck(false)
        const scrollOffset = scrollParent instanceof Element ? scrollParent.scrollTop : window.scrollY
        const parentTop = scrollParent instanceof Element ? scrollParent.getBoundingClientRect().top : 0
        const stickyTop = parentTop + parseFloat(window.getComputedStyle(element).top || '0')
        return setStuck(scrollOffset > 0 && Math.abs(element.getBoundingClientRect().top - stickyTop) < 2)
      })
    }
    scrollParent.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      cancelAnimationFrame(frame)
      scrollParent.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ref, enabled])

  return stuck
}
