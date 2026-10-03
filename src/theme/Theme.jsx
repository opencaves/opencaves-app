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

// MD3 icon buttons, by MUI size: small = MD3 extra small (32dp, 20dp icon),
// medium = MD3 small, the standard one (40dp, 24dp icon), large = MD3 medium
// (56dp, 24dp icon). Every size keeps a 48dp touch target; buttons side by
// side are 8dp apart (IconButtonGroup) so the targets don't overlap.
const ICON_BUTTON = {
  touchTarget: 48,
  gap: 8,
  small: { size: 32, iconSize: 20 },
  medium: { size: 40, iconSize: 24 },
  large: { size: 56, iconSize: 24 },
}
// MUI's own buttons inside fields (an Autocomplete's clear and open icons)
// keep their sizes. Only the button's own icon (its direct child) is sized:
// icons inside a composite one - the key in a pin badge - keep theirs.
const iconButtonSize = ({ size, iconSize }) => ({
  '&:not(.MuiAutocomplete-clearIndicator):not(.MuiAutocomplete-popupIndicator)': {
    padding: (size - iconSize) / 2,
    '& > .MuiSvgIcon-root': { fontSize: iconSize },
  },
})

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
    warning: {
      main: '#eacc01',
    },
    success: {
      main: '#5da426',
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
    // As CSS variables too (--mui-oc-iconButton-*), for what isn't a MUI
    // IconButton - the photo viewer's toolbar.
    iconButton: {
      size: `${ICON_BUTTON.medium.size}px`,
      padding: `${(ICON_BUTTON.medium.size - ICON_BUTTON.medium.iconSize) / 2}px`,
      gap: `${ICON_BUTTON.gap}px`,
      touchTarget: `${ICON_BUTTON.touchTarget}px`,
    },
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
    MuiIconButton: {
      styleOverrides: {
        // The 48dp touch target, invisible, around a smaller button.
        root: {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `max(100%, ${ICON_BUTTON.touchTarget}px)`,
            height: `max(100%, ${ICON_BUTTON.touchTarget}px)`,
            transform: 'translate(-50%, -50%)',
          },
        },
        sizeSmall: iconButtonSize(ICON_BUTTON.small),
        sizeMedium: iconButtonSize(ICON_BUTTON.medium),
        sizeLarge: iconButtonSize(ICON_BUTTON.large),
      },
      variants: [
        {
          // A dense toolbar's buttons (the Markdown editor's): 30px with a
          // 20dp icon, side by side - no wider touch target, which would cover
          // the neighbours. On a touch screen, 48dp with a 24dp icon.
          props: { size: 'compact' },
          style: {
            padding: 5,
            '& > .MuiSvgIcon-root': { fontSize: 20 },
            '&::before': { width: '100%', height: '100%' },
            '@media (pointer: coarse)': {
              padding: 12,
              '& > .MuiSvgIcon-root': { fontSize: 24 },
            },
          },
        },
      ],
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
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
