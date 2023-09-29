import { forwardRef, useMemo, useState } from 'react'
import { Box, styled } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import logoLight from '@/images/logo/logo_light.svg'
import logoDark from '@/images/logo/logo_dark.svg'
import brandLight from '@/images/logo/brand_light.svg'
import brandDark from '@/images/logo/brand_dark.svg'
import brandShortLight from '@/images/logo/brand-short_light.svg'
import brandShortDark from '@/images/logo/brand-short_dark.svg'

const ImgRoot = styled(Box, {
  name: 'OCLogo',
  slot: 'root'
})(({ theme }) => ({
}))

const Logo = forwardRef(function Logo(props, ref) {
  const { variant = 'logo', alt = '', colorScheme, ...other } = props
  const { mode } = useColorScheme()
  const [src, setSrc] = useState()

  function getSrc(variant, mode) {

    function chooseFromMode(...choices) {
      return mode === 'light' ? choices[0] : choices[1]
    }

    switch (variant) {
      case 'brand': return chooseFromMode(brandLight, brandDark)
      case 'brand-short': return chooseFromMode(brandShortLight, brandShortDark)
      default: return chooseFromMode(logoLight, logoDark)
    }
  }

  useMemo(() => {
    // If colorScheme is defined and has a valid value,
    // then use the provided colorScheme
    if (typeof colorScheme === 'string' && colorScheme && ['light', 'dark'].includes(colorScheme)) {
      setSrc(getSrc(variant, colorScheme))
      return
    }

    setSrc(getSrc(variant, mode))
  }, [variant, mode, colorScheme])

  return (
    <ImgRoot
      ref={ref}
      {...other}
    >
      <img src={src} alt={alt} style={{ width: '100%', height: 'auto' }} />
    </ImgRoot>
  )
})

export default Logo