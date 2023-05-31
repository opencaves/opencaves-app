import { createTheme } from '@mui/material/styles'
import { extendTheme } from "@mui/material-next/styles"

const themeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1b4859',
    },
    secondary: {
      main: '#d9b504',
    },
    error: {
      main: '#d2142a',
    },
    warning: {
      main: '#eacc01',
    },
    success: {
      main: '#5da426',
    },
  },
  components: {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#000',
          color: '#fff',
          paddingStart: '8px',
          paddingEnd: '8px',
          paddingTop: '2px',
          paddingBottom: '2px',
          margin: '4px!important',

          borderRadius: '6px',
          lineHeight: '1.25rem',
          fontWeight: '400',
          letterSpacing: '0.01428571em',
          fontSize: '0.75rem'
        }
      }
    }
  }
}

const nextThemeOptions = {
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#1b4859',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#1b4859',
        },
      },
    },
  },
}

export const theme = createTheme(themeOptions)

export const nextTheme = extendTheme(nextThemeOptions)