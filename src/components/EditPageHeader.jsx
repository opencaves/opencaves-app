import { useRef } from 'react'
import { Box } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useStuck } from '@/hooks/useStuck.js'

/**
 * An edit page's back button + title row. Above phone width it sticks below
 * the app bar while the form scrolls (filled, with a shadow, once it's
 * actually stuck - {@link useStuck}, like StickyActionBar; transparent
 * otherwise); on phones it scrolls away and AppBar shows the title in
 * the toolbar instead (its data-appbar-page-title). --oc-edit-header-top is
 * where it sticks: the app bar's height by default, 0 inside a pane with its
 * own scroll area (SistemaEditPane).
 */
export default function EditPageHeader({ children }) {
  const isSmall = useSmall()
  const headerRef = useRef(null)
  const isStuck = useStuck(headerRef, !isSmall)

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
          // No fill at its place in the page (the title on the page's
          // surface); the page's surface, and a shadow, once stuck.
          bgcolor: isStuck ? 'var(--oc-page-surface)' : 'transparent',
          boxShadow: isStuck ? '0 2px 8px rgba(0, 0, 0, 0.12)' : 'none',
          transition: theme.transitions.create(['background-color', 'box-shadow'], { duration: theme.sys.motion.duration.standard, easing: theme.sys.motion.easing.standard }),
        }),
      })}
    >
      {children}
    </Box>
  )
}
