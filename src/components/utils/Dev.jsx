import { Suspense, lazy } from 'react'

const DebugBreakpoints = lazy(() => import('./DebugBreakpoints.jsx'))
const ModeSwitcher = lazy(() => import('./ModeSwitcher.jsx'))

/**
 * In development only: the light/dark mode switcher and the breakpoint
 * badge.
 *
 * @param {object} props
 * @param {Sx} [props.sx] - The mode switcher's.
 */
export default function Dev({ sx }) {
  const dev = import.meta.env.DEV

  return dev ? (
    <>
      <Suspense fallback={null}>
        <ModeSwitcher sx={sx} />
      </Suspense>

      <Suspense fallback={null}>
        <DebugBreakpoints />
      </Suspense>
    </>
  ) : null
}
