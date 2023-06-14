import { createTheme } from '@mui/material/styles'
import { extendTheme } from "@mui/material-next/styles"
import { merge } from 'lodash'

const lightThemeOptions = {
  palette: {
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
  typography: {
    caveDetailsHeader: {
      fontSize: '1.125rem',
      lineHeight: '1.5rem',
      fontWeight: 400
    },
    caveDetailsSubHeader: {
      color: 'theme.text.secondary'
    }
  },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          caveDetailsHeader: 'h1',
          caveDetailsSubHeader: 'p'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '36px',
          letterSpacing: '0.06em'
        },
        // outlinedPrimary: {
        //   color: 'black'
        // },
      }
    },
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
    },
    MuiRating: {
      styleOverrides: {
        iconEmpty: {
          color: 'rgb(218, 220, 224)'
        }
      }
    }
  }
}

const darkThemeOptions = {
  palette: {
    primary: {
      main: '#30a4b5',
    },
    secondary: {
      main: '#d9b504',
    },
    error: {
      main: '#EE495C',
    },
    warning: {
      main: '#eacc01',
    },
    success: {
      main: '#6CBE2D',
    },
    text: {
      primary: '#d3cfc9',
      secondary: '#B2A9A4'
    }
  },
  components: {
    // MuiTooltip: {
    //   styleOverrides: {
    //     tooltip: {
    //       backgroundColor: '#000',
    //       color: '#fff',
    //     }
    //   }
    // },
    MuiRating: {
      styleOverrides: {
        iconEmpty: {
          color: 'rgb(218, 220, 224)'
        }
      }
    }
  }
}

// const nextThemeOptions = {
//   colorSchemes: {
//     light: {
//       palette: {
//         primary: {
//           main: '#1b4859',
//         },
//       },
//     },
//     dark: {
//       palette: {
//         primary: {
//           main: '#1b4859',
//         },
//       },
//     },
//   },
// }

export function getTheme(mode) {
  return mode === 'light' ? createTheme(lightThemeOptions) : createTheme(merge({}, lightThemeOptions, darkThemeOptions))
}

export const theme = extendTheme({
  colorSchemes: {
    light: lightThemeOptions,
    dark: merge({}, lightThemeOptions, darkThemeOptions)
  }
})

// export const nextTheme = extendTheme(nextThemeOptions)