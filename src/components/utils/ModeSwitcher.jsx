import { useState, useEffect } from 'react'
import Button from '@mui/material/Button'
import { useColorScheme } from '@mui/material/styles'

// ModeSwitcher is an example interface for toggling between modes.
// Material UI does not provide the toggle interface—you have to build it yourself.
export default function ModeSwitcher(props) {
  const { mode, setMode } = useColorScheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // for server-side rendering
    // learn more at https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
    return null
  }

  return (
    <Button
      variant="contained"
      onClick={() => {
        if (mode === 'light') {
          setMode('dark')
        } else {
          setMode('light')
        }
      }}
      style={{
        position: 'absolute',
        top: 'var(--oc-mode-switcher-top, 1rem)',
        right: 'var(--oc-mode-switcher-right, 1rem)',
        fontSize: '.65rem',
        minWidth: 'unset',
        opacity: .5,
        padding: '0 1.5em',
        lineHeight: '2.5em',
        // zIndex: 1000000,
        zIndex: 'calc(var(--md-zIndex-modal) - 1)',
        '&:hover': {
          opacity: 1
        }
      }}
      {...props}
    >
      {mode === 'light' ? 'Dark' : 'Light'}
    </Button>
  )
}
