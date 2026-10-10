// The app's own additions to MUI's theme (Theme.jsx) - for the type checker
// only (npm run typecheck): its M3 `sys` and `oc` token groups, its brand
// palette colors and its Typography variants.

import '@mui/material/styles'
import '@mui/material/Typography'
import '@mui/material/Button'
import '@mui/material/Paper'
import '@mui/material/AccordionSummary'
import '@mui/material/AccordionDetails'
import '@mui/material/IconButton'

/** M3 color roles the theme defines (light and dark schemes). */
interface OcSysColor {
  surfaceContainerHigh: string
  surfaceContainerHighest: string
  outlineVariant: string
  surfaceContainer: string
  primary: string
  outline: string
  secondaryContainer: string
  onSecondaryContainer: string
  inverseSurface: string
  inverseOnSurface: string
  inversePrimary: string
}

/** M3 motion durations, in milliseconds. */
interface OcMotionDuration {
  emphasized: number
  emphasizedAccelerate: number
  emphasizedDecelerate: number
  standard: number
  standardDecelerate: number
  standardAccelerate: number
}

/** M3 system tokens (`theme.sys`, `theme.vars.sys`). */
interface OcSys {
  color: OcSysColor
  motion: {
    duration: OcMotionDuration
    easing: {
      emphasizedAccelerate: string
      emphasizedDecelerate: string
      standard: string
      standardAccelerate: string
      standardDecelerate: string
    }
  }
}

/** The app's own tokens (`theme.oc`, `theme.vars.oc`). */
interface OcTokens {
  iconButton: { size: string; padding: string; gap: string; touchTarget: string }
  sys: { motion: { duration: OcMotionDuration } }
}

/** A brand color (a sign-in provider's button). */
interface OcBrandColor {
  main: string
  contrastText: string
}

declare module '@mui/material/styles' {
  interface Theme {
    sys: OcSys
    oc: OcTokens
  }
  interface ThemeVars {
    sys: OcSys
    oc: OcTokens
  }
  interface CssVarsThemeOptions {
    sys?: Partial<OcSys>
    oc?: Partial<OcTokens>
  }
  interface Palette {
    facebook: OcBrandColor
    google: OcBrandColor
    microsoft: OcBrandColor
    apple: OcBrandColor
  }
  interface PaletteOptions {
    facebook?: OcBrandColor
    google?: OcBrandColor
    microsoft?: OcBrandColor
    apple?: OcBrandColor
  }
  interface TypographyVariants {
    titlebarTitle: React.CSSProperties
    authStepHeader: React.CSSProperties
    mapTextSecondary: React.CSSProperties
    mapTextSmall: React.CSSProperties
    caveDetailsHeader: React.CSSProperties
    caveDetailsSubHeader: React.CSSProperties
    caveDetailsSectionHeader: React.CSSProperties
    caveDetailsBodySecondary: React.CSSProperties
    caveDetailsItemText: React.CSSProperties
    sistemaHistoryTextSecondary: React.CSSProperties
    fontTitleLarge: React.CSSProperties
    md3Input: React.CSSProperties
    md3Placeholder: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    titlebarTitle?: React.CSSProperties
    authStepHeader?: React.CSSProperties
    mapTextSecondary?: React.CSSProperties
    mapTextSmall?: React.CSSProperties
    caveDetailsHeader?: React.CSSProperties
    caveDetailsSubHeader?: React.CSSProperties
    caveDetailsSectionHeader?: React.CSSProperties
    caveDetailsBodySecondary?: React.CSSProperties
    caveDetailsItemText?: React.CSSProperties
    sistemaHistoryTextSecondary?: React.CSSProperties
    fontTitleLarge?: React.CSSProperties
    md3Input?: React.CSSProperties
    md3Placeholder?: React.CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    titlebarTitle: true
    authStepHeader: true
    mapTextSecondary: true
    mapTextSmall: true
    caveDetailsHeader: true
    caveDetailsSubHeader: true
    caveDetailsSectionHeader: true
    caveDetailsBodySecondary: true
    caveDetailsItemText: true
    sistemaHistoryTextSecondary: true
    fontTitleLarge: true
    md3Input: true
    md3Placeholder: true
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    facebook: true
    google: true
    microsoft: true
    apple: true
  }
}

// The theme's own component variants (Theme.jsx's `variants`): the system
// history's accordion, the Markdown toolbar's compact icon buttons.
declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides {
    sistemaHistory: true
  }
}

declare module '@mui/material/AccordionSummary' {
  interface AccordionSummaryOwnProps {
    variant?: 'sistemaHistory'
  }
}

declare module '@mui/material/AccordionDetails' {
  interface AccordionDetailsProps {
    variant?: 'sistemaHistory'
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsSizeOverrides {
    compact: true
  }
}
