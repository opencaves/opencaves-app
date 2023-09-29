import { Profiler as ReactProfiler } from 'react'

export default function Profiler({ name, children }) {
  return (
    <ReactProfiler
      id={name}
      onRender={(id, phase, actualDuration, baseDuration,) => {

        // console.log('[profiler] %s: %o', id, { phase, actualDuration, baseDuration })
      }}
    >
      {children}
    </ReactProfiler>
  )
}