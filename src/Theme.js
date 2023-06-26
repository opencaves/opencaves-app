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
    text: {
      // secondary: '#f00'
    }
  },
  typography: {
    caveDetailsHeader: {
      fontSize: '1.375rem',
      lineHeight: '1.75rem',
      fontWeight: 400
    },
    caveDetailsSubHeader: {
      // color: 'theme.text.secondary'
      color: 'var(--md-palette-text-secondary)',
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: '1.25rem',
      letterSpacing: 0
    },
    caveDetailsBodySecondary: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a'
    },
    caveDetailsItemText: {
      fontSize: '0.875rem',
      flex: '1 1 auto',
      marginTop: '4px',
      marginBottom: '4px'
    },
    sistemaHistoryHeader: {
      color: 'theme.text.secondary',
      fontSize: '.9em',
      fontWeight: '400',
      lineHeight: '1.5',
      paddingTop: 'var(--oc-details-padding-block)',
      paddingBottom: 'var(--oc-details-padding-block)'
    }
  },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          caveDetailsHeader: 'h1',
          caveDetailsSubHeader: 'p',
          sistemaHistoryHeader: 'h2'
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
      // main: '#30a4b5',
      main: '#087e91'
    },
    secondary: {
      main: '#d9b504',
    },
    error: {
      main: '#ee495c',
    },
    warning: {
      main: '#eacc01',
    },
    success: {
      main: '#6Cbe2d',
    },
    text: {
      primary: '#dedbd7',
      secondary: '#989da1'
    }
  },
  components: {
    MuiRating: {
      styleOverrides: {
        iconEmpty: {
          color: 'rgb(218, 220, 224)'
        }
      }
    }
  }
}

export const theme = extendTheme({
  colorSchemes: {
    light: lightThemeOptions,
    dark: merge({}, lightThemeOptions, darkThemeOptions)
  }
})