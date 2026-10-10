import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Fab, Tooltip } from '@mui/material'

// The space kept between the FAB and a snackbar under it (M3: 8dp).
const SNACKBAR_GAP = 8

// How far the FAB must rise to clear the snackbar shown (M3: a snackbar at
// the bottom pushes a FAB up, never covering it nor sitting behind it): the
// snackbar's top, measured as laid out (not mid-slide), plus the gap, less
// the FAB's own distance from the bottom; 0 without one, or when they don't
// overlap (a narrow snackbar centered on a wide screen).
function useSnackbarLift(fabRef) {
  const [lift, setLift] = useState(0)
  useEffect(() => {
    let resizeObserver = null
    let observed = null
    function measure() {
      const fab = fabRef.current
      const bar = document.querySelector('.MuiSnackbar-root')
      if (bar !== observed) {
        resizeObserver?.disconnect()
        observed = bar
        if (bar) {
          resizeObserver = new ResizeObserver(measure)
          resizeObserver.observe(bar)
        }
      }
      if (!fab || !bar) return setLift(0)
      const barRect = bar.getBoundingClientRect()
      const fabRect = fab.getBoundingClientRect()
      if (barRect.left >= fabRect.right || barRect.right <= fabRect.left) return setLift(0)
      const barBottom = parseFloat(window.getComputedStyle(bar).bottom) || 0
      const fabBottom = parseFloat(window.getComputedStyle(fab).bottom) || 0
      return setLift(Math.max(0, bar.offsetHeight + barBottom + SNACKBAR_GAP - fabBottom))
    }
    measure()
    // Snackbars come and go as portals, children of the body.
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(document.body, { childList: true })
    window.addEventListener('resize', measure)
    return () => {
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [fabRef])
  return lift
}

/**
 * A page's floating action button, as Material Design 3 places it: a 56dp
 * FAB, round as the map's own FABs, 16dp from the screen's bottom and right edges on
 * phones (compact width), 24dp from 600px up, plus the device's safe area -
 * pushed up while a snackbar shows under it ({@link useSnackbarLift}).
 *
 * @param {object} props
 * @param {string} [props.to] - A link; or onClick.
 * @param {string} props.label - Its tooltip and accessible name.
 */
export default function PageFab({ to, onClick, label, icon, className }) {
  const edge = (margin, side) => `calc(${margin}px + env(safe-area-inset-${side}, 0px))`
  const ref = useRef(null)
  const lift = useSnackbarLift(ref)
  return (
    <Tooltip title={label} placement="left">
      <Fab
        ref={ref}
        className={['oc-page-fab', className].filter(Boolean).join(' ')}
        color="primary"
        {...(to ? { component: Link, to } : { onClick })}
        aria-label={label}
        sx={(theme) => ({
          position: 'fixed',
          borderRadius: '50%',
          bottom: { xs: edge(16, 'bottom'), sm: edge(24, 'bottom') },
          right: { xs: edge(16, 'right'), sm: edge(24, 'right') },
          transform: lift ? `translateY(${-lift}px)` : 'none',
          // M3's standard easing and duration, as the snackbar slides in.
          transition: theme.transitions.create(['transform', 'box-shadow', 'background-color'], { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      >
        {icon}
      </Fab>
    </Tooltip>
  )
}
