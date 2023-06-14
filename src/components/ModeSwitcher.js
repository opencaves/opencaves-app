import {useState, useEffect} from 'react'
import Button from '@mui/material/Button'
import {   Experimental_CssVarsProvider as CssVarsProvider,   useColorScheme} from '@mui/material/styles'

// ModeSwitcher is an example interface for toggling between modes.
// Material UI does not provide the toggle interface—you have to build it yourself.
export default function ModeSwitcher () {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // for server-side rendering
    // learn more at https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
    return null;
  }

  return (
    <Button
      variant="contained"
      onClick={() => {
        if (mode === 'light') {
          setMode('dark');
        } else {
          setMode('light');
        }
      }}
      style={{
        position: 'absolute',
        right: '.5em',
        top: '.5em',
        fontSize: '.75rem',
        opacity: .75,
        zIndex: 1000000
      }}
    >
      {mode === 'light' ? 'Dark' : 'Light'}
    </Button>
  )
}
