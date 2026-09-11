import { Suspense, lazy } from 'react'

const DebugBreakpoints = lazy(() => import('./DebugBreakpoints.jsx'))
const ModeSwitcher = lazy(() => import('./ModeSwitcher.jsx'))

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
