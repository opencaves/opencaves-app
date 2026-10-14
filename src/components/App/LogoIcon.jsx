import { Box } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import LogoLight from '@/images/logo/logo_light.svg?react'
import LogoDark from '@/images/logo/logo_dark.svg?react'

/**
 * The app's logo mark (no wordmark), 24px, drawn for the color scheme. An
 * inline SVG hidden from screen readers: it always sits by the app's name, so
 * it is decorative - and not an <img>, which search engines (Bing) report as
 * missing its alt even with an empty one.
 *
 * @param {{ colorScheme?: 'light' | 'dark' } & import('@mui/material/Box').BoxProps} props - A
 *   Box's; `colorScheme` forces one scheme's drawing.
 */
export default function LogoIcon({ colorScheme, ...props }) {
  const { mode } = useColorScheme()
  const { sx, className, ...other } = props
  const Logo = colorScheme === 'light' || (colorScheme !== 'dark' && mode === 'light') ? LogoLight : LogoDark

  return <Box component={Logo} aria-hidden="true" focusable="false" className={`oc-logo-icon ${className || ''}`.trim()} sx={{ width: 24, height: 24, display: 'block', flexShrink: 0, ...sx }} {...other} />
}
