import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useState } from 'react'

export default function DebugBreakpoints() {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.only('xs'))
  const isSm = useMediaQuery(theme.breakpoints.only('sm'))
  const isMd = useMediaQuery(theme.breakpoints.only('md'))
  const isLg = useMediaQuery(theme.breakpoints.only('lg'))
  const isXl = useMediaQuery(theme.breakpoints.up('xl'))
  const [breakpoint, setBreakpoint] = useState()

  useEffect(() => {
    isXs && setBreakpoint('xs')
    isSm && setBreakpoint('sm')
    isMd && setBreakpoint('md')
    isLg && setBreakpoint('lg')
    isXl && setBreakpoint('xl')
  }, [isXs, isSm, isMd, isLg, isXl])

  // 

  return breakpoint && (
    <div
      style={{
        position: 'absolute',
        left: '.5em',
        top: '.5em',
        fontSize: '.75rem',
        color: '#fff',
        backgroundColor: 'red',
        lineHeight: 1,
        padding: '.2em',
        opacity: .75,
        zIndex: 1000000
      }}>
      {breakpoint}
    </div>
  )
}
