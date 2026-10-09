import { extendTheme } from '@mui/material/styles'
import { merge } from 'lodash'

// old
// 1b4859
// d9b504

// new
// 144579
// ac2929

// secondary: b49d2b

// // MUI default breakpoints
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
}

const DIVIDER_ALPHA = 0.18

const lightThemeOptions = {
  palette: {
    primary: {
      main: '#145e79',
    },
    secondary: {
      main: '#d9b504',
    },
    error: {
      main: '#d2142a',
    },
    // Their dark tones: readable on the light surfaces (icons and text, 3:1
    // and more - the main amber was 1.4:1).
    warning: {
      main: '#eacc01',
      dark: '#8a6d00',
    },
    success: {
      main: '#5da426',
      dark: '#3b7d1a',
    },
    divider: `rgba(0, 0, 0, ${DIVIDER_ALPHA})`,
    facebook: {
      main: '#3b5998',
      contrastText: '#fff',
    },
    google: {
      main: '#fff',
      contrastText: '#757575',
    },
    microsoft: {
      main: '#2F2F2F',
      contrastText: '#fff',
    },
    apple: {
      main: '#000',
      contrastText: '#fff',
    },
    Scrollbar: {
      bg: 'rgb(193 193 193)',
    },
  },
  sys: {
    color: {
      surfaceContainerHigh: '#eceae9',
      surfaceContainerHighest: '#dedad8',
      // M3 outline-variant: decorative edges (a thumbnail's outline).
      outlineVariant: '#c8c5c2',
      // M3's inverse roles (a snackbar's): its container, its text and icons,
      // its action - a light tone of the primary on the light theme's dark
      // snackbar.
      // M3's surface container (the app bar once the page scrolls under it)
      // and secondary container (the current page's pill in the app bar).
      surfaceContainer: '#f3f1f0',
      // M3's primary and outline roles, as text and edges on the surface
      // (the app bar's Log in and Sign up): the dark scheme's primary a light
      // tone, readable on its near-black surface.
      primary: '#145e79',
      outline: '#79747e',
      secondaryContainer: '#cfe6f1',
      onSecondaryContainer: '#0b1f27',
      inverseSurface: '#313033',
      inverseOnSurface: '#f4eff4',
      inversePrimary: '#8bcfe8',
    },
    motion: {
      duration: {
        emphasized: 500,
        // emphasizedAccelerate: 200,
        // emphasizedDecelerate: 400,
        emphasizedAccelerate: 200,
        emphasizedDecelerate: 400,
        standard: 300,
        standardDecelerate: 250,
        standardAccelerate: 200,
      },
      easing: {
        emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
        standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
      },
    },
  },
  oc: {
    sys: {
      motion: {
        duration: {
          emphasized: 500,
          // emphasizedAccelerate: 200,
          // emphasizedDecelerate: 400,
          emphasizedAccelerate: 200,
          emphasizedDecelerate: 400,
          standard: 300,
          standardDecelerate: 250,
          standardAccelerate: 200,
        },
      },
    },
  },
  typography: {
    h1: {
      fontSize: 64,
    },
    titlebarTitle: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1,
      color: 'hsl(0 0% 96% / 1)',
    },
    authStepHeader: {
      fontSize: 25,
      lineHeight: '1.75rem',
      fontWeight: 400,
    },
    mapTextSecondary: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a',
    },
    mapTextSmall: {
      fontSize: 'var(--oc-map-text-small-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a',
    },
    caveDetailsHeader: {
      fontSize: '1.375rem',
      lineHeight: '1.875rem',
      fontWeight: 400,
    },
    caveDetailsSubHeader: {
      // color: 'theme.text.secondary'
      color: 'var(--mui-palette-text-secondary)',
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      letterSpacing: 0,
    },
    caveDetailsSectionHeader: {
      fontSize: '1rem',
      fontWeight: '500',
      lineHeight: '1.5',
      padding: 'var(--oc-pane-padding-block) var(--oc-pane-padding-inline)',
    },
    caveDetailsBodySecondary: {
      fontSize: 'var(--oc-map-text-primary-font-size)',
      fontWeight: 400,
      lineHeight: '1.25rem',
      color: '#70757a',
    },
    caveDetailsItemText: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      flex: '1 1 auto',
    },
    sistemaHistoryTextSecondary: {
      fontSize: 'var(--oc-map-text-secondary-font-size)',
      color: 'var(--mui-palette-text-secondary)',
    },
    fontTitleLarge: {
      fontSize: '1.125rem',
      lineHeight: '1.5rem',
      letterSpacing: 0,
      fontWeight: 400,
    },
    md3Input: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: '1.5rem',
      letterSpacing: '0.03125rem',
      color: 'var(--mui-palette-text-primary)',
    },
    md3Placeholder: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: '1.5rem',
      letterSpacing: '0.03125rem',
      color: 'var(--mui-palette-text-secondary)',
    },
  },
  components: {
    // Dark: a focused field's label in M3's dark primary (the palette's
    // primary, made for the light theme, read at 2.4:1 there). Here: these
    // components are the theme's (the default scheme's), extendTheme's own
    // components were replaced by them.
    MuiFormLabel: {
      styleOverrides: {
        root: ({ theme }) => theme.applyStyles('dark', { '&.Mui-focused': { color: theme.vars.sys.color.primary } }),
      },
    },
    // Primary-coloured text reads the scheme's primary role (sys.color.primary):
    // the teal itself on the light theme, a light teal on the dark one - the
    // teal palette colour was too dark there for text (3 to 3.9:1 on the dark
    // surfaces; 4.5:1 needed). Filled buttons and FABs keep the teal, with
    // white (4.8:1).
    MuiLink: {
      styleOverrides: {
        root: ({ ownerState }) => (ownerState.color === 'primary' ? { color: 'var(--mui-sys-color-primary)', textDecorationColor: 'color-mix(in srgb, var(--mui-sys-color-primary) 40%, transparent)' } : {}),
      },
    },
    MuiTab: {
      // The focus ring only (variables.scss), as M3's tabs: the focus ripple's
      // circle was cut off by the tab strip.
      defaultProps: { disableFocusRipple: true },
      styleOverrides: {
        // Sentence case, as M3's tabs and the rest of the app (MUI's are capitals).
        root: { textTransform: 'none', '&.Mui-selected': { color: 'var(--mui-sys-color-primary)' } },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
      },
    },
    // Every snackbar as M3's (m3.material.io/components/snackbar/specs): an
    // opaque inverse surface (dark in the light theme, light in the dark one)
    // at elevation level 3, extra-small corners (4dp), its text in inverse
    // on-surface and body medium, 48dp tall on one line (more with two), 16dp
    // in, 8dp at the end when it has an action or a close button; its action a
    // text button in inverse primary, its close icon in inverse on-surface.
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: 'var(--mui-sys-color-inverseSurface)',
          color: 'var(--mui-sys-color-inverseOnSurface)',
          borderRadius: 4,
          boxShadow: theme.shadows[6],
          minHeight: 48,
          padding: '0 8px 0 16px',
          // The action or close button beside the text, not under it.
          flexWrap: 'nowrap',
          ...theme.typography.body2,
          letterSpacing: '0.015625rem',
        }),
        message: { padding: '14px 8px 14px 0', flex: '1 1 auto', minWidth: 0 },
        action: {
          marginRight: 0,
          paddingLeft: 0,
          '& .MuiButton-root': { color: 'var(--mui-sys-color-inversePrimary)' },
          '& .MuiIconButton-root': { color: 'var(--mui-sys-color-inverseOnSurface)' },
        },
      },
    },
    // A multiline field's right and bottom padding on its textarea, not
    // around it: a resizable one's handle then sits in the field's corner.
    MuiFilledInput: {
      styleOverrides: {
        multiline: {
          paddingRight: 0,
          paddingBottom: 0,
          '& > textarea': { paddingRight: 12, paddingBottom: 8 },
          '&.MuiInputBase-sizeSmall > textarea': { paddingBottom: 4 },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        multiline: {
          paddingRight: 0,
          paddingBottom: 0,
          '& > textarea': { paddingRight: 14, paddingBottom: 16.5 },
          '&.MuiInputBase-sizeSmall > textarea': { paddingBottom: 8.5 },
        },
      },
    },
    MuiAccordion: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            backgroundColor: 'transparent',
            padding: '6px 0',
            '&:before': {
              content: 'none',
            },
            '&:after': {
              content: 'none',
            },
          },
        },
      ],
    },
    MuiAccordionDetails: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            fontSize: 'var(--oc-map-text-primary-font-size)',
            padding: '0 var(--oc-pane-padding-inline) var(--oc-pane-padding-block) calc(var(--oc-details-icon-min-width) + 24px)',
          },
        },
      ],
    },
    MuiAccordionSummary: {
      variants: [
        {
          props: { variant: 'sistemaHistory' },
          style: {
            padding: '0 var(--oc-pane-padding-inline)',
            minHeight: '40px',
            '& > .MuiAccordionSummary-content': {
              margin: '6px 0',
            },
          },
        },
      ],
    },
    MuiButton: {
      styleOverrides: {
        // root: {
        //   textTransform: 'none',
        //   borderRadius: '20px',
        //   letterSpacing: '0.06em',
        //   lineHeight: '40px',
        //   paddingTop: 0,
        //   paddingBottom: 0,
        //   paddingLeft: 24,
        //   paddingRight: 24,
        //   '.MuiButton-startIcon': {
        //     marginLeft: -8
        //   }
        // },
        root: ({ theme, ownerState }) => ({
          // Default styles
          ...{
            textTransform: 'none',
            borderRadius: '1.25rem',
            letterSpacing: '0.06em',
            lineHeight: '2.5rem',
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 24,
            paddingRight: 24,
            '.MuiButton-startIcon': {
              marginLeft: -8,
            },
            // ':hover': {
            //   boxShadow: theme.shadows[1]
            // }
          },
          ...(ownerState.size === 'small' && {
            lineHeight: '2.25rem',
            borderRadius: '1.125rem',
            paddingLeft: 22,
            paddingRight: 22,
          }),
          ...(ownerState.color === 'inherit' &&
            ownerState.variant === 'outlined' && {
              borderColor: '#dadce0',
            }),
          // Text and outlined buttons' teal text: the scheme's primary role
          // (see MuiLink above).
          ...(ownerState.color === 'primary' &&
            ownerState.variant !== 'contained' && {
              color: 'var(--mui-sys-color-primary)',
            }),
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        // Not around a full-screen dialog (phones): it must fill the screen.
        root: ({ ownerState }) => ownerState.fullScreen ? {} : {
          paddingTop: 24,
          paddingBottom: 24,
        },
        paper: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.paper,
        }),
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          paddingTop: 0,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 24,
        },
      },
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
          fontSize: 'var(--oc-map-text-secondary-font-size)',
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          caveDetailsHeader: 'h1',
          caveDetailsSubHeader: 'p',
          caveDetailsSectionHeader: 'h2',
        },
      },
    },
    MuiRating: {
      styleOverrides: {
        iconEmpty: {
          color: 'rgb(218, 220, 224)',
        },
      },
    },
  },
}

const darkThemeOptions = {
  sys: {
    color: {
      // M3's baseline dark surface containers: a shade lighter than the
      // paper (#1c1b1f) the sections inside them use.
      surfaceContainerHigh: '#2b2930',
      surfaceContainerHighest: '#36343b',
      outlineVariant: '#474a4c',
      // The dark theme's light snackbar, its action the light theme's primary.
      surfaceContainer: '#211f26',
      primary: '#8bcfe8',
      outline: '#938f99',
      secondaryContainer: '#33494f',
      onSecondaryContainer: '#cfe6f1',
      inverseSurface: '#e6e1e5',
      inverseOnSurface: '#313033',
      inversePrimary: '#145e79',
    },
  },
  palette: {
    primary: {
      // main: '#30a4b5',
      main: '#087e91',
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
    divider: `rgba(255, 255, 255, ${DIVIDER_ALPHA})`,
    Scrollbar: {
      bg: 'rgb(62 62 62)',
    },
    text: {
      primary: '#dedbd7',
      secondary: '#989da1',
    },
    background: {
      paper: '#1c1b1f',
    },
  },
  components: {
    MuiRating: {
      styleOverrides: {
        iconEmpty: {
          color: 'rgb(218, 220, 224)',
        },
      },
    },
  },
}

export const theme = extendTheme({
  sys: lightThemeOptions.sys,
  oc: lightThemeOptions.oc,
  colorSchemeSelector: 'data-mui-color-scheme',
  colorSchemes: {
    light: lightThemeOptions,
    dark: merge({}, lightThemeOptions, darkThemeOptions),
  },
})
