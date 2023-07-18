import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export default function DebugBreakpoints() {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.only('xs'))
  const isSm = useMediaQuery(theme.breakpoints.only('sm'))
  const isMd = useMediaQuery(theme.breakpoints.only('md'))
  const isLg = useMediaQuery(theme.breakpoints.only('lg'))
  const breakpoint = isXs ? 'xs' : isSm ? 'sm' : isMd ? 'md' : isLg ? 'lg' : 'xl'

  return (
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
