import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'

function findScrollParent(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY)) return parent
  }
  return window
}

/**
 * An edit page's back button + title row. Above phone width it sticks below
 * the app bar while the form scrolls (a shadow once it's actually stuck, like
 * StickyActionBar); on phones it scrolls away and AppBar shows the title in
 * the toolbar instead (its data-appbar-page-title). --oc-edit-header-top is
 * where it sticks: the app bar's height by default, 0 inside a pane with its
 * own scroll area (SistemaEditPane).
 */
export default function EditPageHeader({ children }) {
  const isSmall = useSmall()
  const headerRef = useRef(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const header = headerRef.current
    if (!header || isSmall) {
      setIsStuck(false)
      return undefined
    }

    const scrollParent = findScrollParent(header)
    let animationFrame

    function updateStickyState() {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const scrollOffset = scrollParent === window ? window.scrollY : scrollParent.scrollTop
        const parentTop = scrollParent === window ? 0 : scrollParent.getBoundingClientRect().top
        const stickyTop = parentTop + parseFloat(window.getComputedStyle(header).top || '0')
        setIsStuck(scrollOffset > 0 && Math.abs(header.getBoundingClientRect().top - stickyTop) < 2)
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
  }, [isSmall])

  return (
    <Box
      ref={headerRef}
      className="oc-edit-page-header"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
        ...(!isSmall && {
          position: 'sticky',
          top: 'var(--oc-edit-header-top, 64px)',
          zIndex: theme.zIndex.appBar - 1,
          py: 1,
          // Out to the page's edges (--oc-page-bleed: Layout's container
          // padding and border; a pane's own padding), so content scrolling
          // under it is covered edge to edge - same width as StickyActionBar.
          mx: 'calc(-1 * var(--oc-page-bleed, calc(24px + 1rem)))',
          px: 'var(--oc-page-bleed, calc(24px + 1rem))',
          bgcolor: 'background.paper',
          boxShadow: isStuck ? '0 2px 8px rgba(0, 0, 0, 0.12)' : 'none',
          transition: 'box-shadow 160ms ease',
        }),
      })}
    >
      {children}
    </Box>
  )
}
