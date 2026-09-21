import { Box } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import LogoLight from '@/images/logo/logo_light.svg'
import LogoDark from '@/images/logo/logo_dark.svg'

export default function LogoIcon({ colorScheme, ...props }) {
  const { mode } = useColorScheme()
  const { sx, ...other } = props
  const src = colorScheme === 'light' || (colorScheme !== 'dark' && mode === 'light') ? LogoLight : LogoDark

  return <Box component="img" src={src} alt="" sx={{ width: 24, height: 24, display: 'block', objectFit: 'contain', flexShrink: 0, ...sx }} {...other} />
}
