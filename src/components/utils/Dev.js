import { Suspense, lazy } from 'react'

const DebugBreakpoints = lazy(() => import('./DebugBreakpoints'))
const ModeSwitcher = lazy(() => import('./ModeSwitcher'))

export default function Dev({ sx }) {
  const dev = process.env.NODE_ENV === 'development'

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
