import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'

function findScrollParent(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY)) return parent
  }
  return window
}

export default function StickyActionBar({ children, gap = 1 }) {
  const actionBarRef = useRef(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const actionBar = actionBarRef.current
    if (!actionBar) return undefined

    const scrollParent = findScrollParent(actionBar)
    let animationFrame

    function updateStickyState() {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const scrollOffset = scrollParent === window ? window.scrollY : scrollParent.scrollTop
        const viewportBottom = scrollParent === window ? window.innerHeight : scrollParent.getBoundingClientRect().bottom
        const actionBarBottom = actionBar.getBoundingClientRect().bottom
        setIsStuck(scrollOffset > 0 && Math.abs(actionBarBottom - viewportBottom) < 2)
      })
    }

    scrollParent.addEventListener('scroll', updateStickyState, { passive: true })
    window.addEventListener('resize', updateStickyState)
    updateStickyState()

    return () => {
      cancelAnimationFrame(animationFrame)
      scrollParent.removeEventListener('scroll', updateStickyState)
      window.removeEventListener('resize', updateStickyState)
    }
  }, [])

  return (
    <Box
      ref={actionBarRef}
      sx={(theme) => ({
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap,
        mt: 3,
        py: 1.5,
        px: { xs: 2, sm: 3 },
        width: '100vw',
        boxSizing: 'border-box',
        ml: 'calc(50% - 50vw)',
        position: 'sticky',
        bottom: 0,
        zIndex: theme.zIndex.appBar,
        bgcolor: 'rgba(255, 255, 255, 0.94)',
        borderTop: '1px solid',
        borderColor: isStuck ? '#fff' : 'divider',
        boxShadow: isStuck ? '0 -2px 8px rgba(0, 0, 0, 0.12)' : 'none',
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
      })}
    >
      {children}
    </Box>
  )
}
