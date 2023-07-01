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
    mapTextSecondary: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a'
    },
    mapTextSmall: {
      fontSize: 'var(--oc-map-text-small-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a'
    },
    caveDetailsHeader: {
      fontSize: '1.375rem',
      lineHeight: '1.75rem',
      fontWeight: 400
    },
    caveDetailsSubHeader: {
      // color: 'theme.text.secondary'
      color: 'var(--md-palette-text-secondary)',
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      letterSpacing: 0
    },
    caveDetailsSectionHeader: {
      fontSize: '1rem',
      fontWeight: '500',
      lineHeight: '1.5',
      padding: 'var(--oc-details-padding-block) var(--oc-details-padding-inline)',
    },
    caveDetailsBodySecondary: {
      fontSize: 'var(--oc-map-text-primary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a'
    },
    caveDetailsItemText: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      flex: '1 1 auto',
    },
    sistemaHistoryTextSecondary: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      color: 'var(--md-palette-text-secondary)',
    }
  },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          caveDetailsHeader: 'h1',
          caveDetailsSubHeader: 'p',
          caveDetailsSectionHeader: 'h2'
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
    MuiAccordion: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            backgroundColor: 'transparent',
            padding: '6px 0',
            '&:before': {
              content: 'none'
            },
            '&:after': {
              content: 'none'
            }
          }
        }
      ]
    },
    MuiAccordionSummary: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            padding: '0 var(--oc-details-padding-inline)',
            minHeight: '40px',
            '& > .MuiAccordionSummary-content': {
              margin: '6px 0'
            }
          }
        }
      ]
    },
    MuiAccordionDetails: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            fontSize: 'var(--oc-map-text-primary-font-size)',
            padding: '0 var(--oc-details-padding-inline) var(--oc-details-padding-block) calc(var(--oc-details-icon-min-width) + 24px)'
          }
        }
      ]
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
          fontSize: 'var(--oc-map-text-secondary-font-size)'
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