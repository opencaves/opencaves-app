import { useMemo, useState } from 'react'
import { SvgIcon } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { ReactComponent as LogoLight } from '@/images/logo/logo_light.svg'
import { ReactComponent as LogoDark } from '@/images/logo/logo_dark.svg'

export default function LogoIcon({ colorScheme, ...props }) {
  const { mode } = useColorScheme()
  const [icon, setIcon] = useState(null)

  useMemo(() => {
    setIcon(colorScheme === 'light' ? LogoLight : LogoDark)
  }, [colorScheme])

  useMemo(() => {
    // If colorScheme is defined and has a valid value,
    // then don't auto mutate icon
    if (typeof colorScheme === 'string' && colorScheme && ['light', 'dark'].includes(colorScheme)) {
      return
    }

    setIcon(mode === 'light' ? LogoLight : LogoDark)

  }, [mode, colorScheme])

  return <SvgIcon
    component={icon}
    inheritViewBox
    {...props}
  />
}