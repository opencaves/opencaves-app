import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Link, Typography } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { useSmall } from '@/hooks/useSmall.jsx'
import { CHANGELOG_URL } from '@/config/app.js'
import LogoLight from '@/images/logo/brand_light.svg?react'
import LogoDark from '@/images/logo/brand_dark.svg?react'

export default function About({ className, ...props }) {
  const { t } = useTranslation('about')
  const { t: tLegal } = useTranslation('legal')
  const isSmall = useSmall()
  // The logo drawn for the surface it's on: its dark teal wordmark is nearly
  // invisible on the dark theme's.
  const { mode, systemMode } = useColorScheme()
  const Logo = ((mode === 'system' ? systemMode : mode) || 'light') === 'dark' ? LogoDark : LogoLight

  return (
    <Box className={`oc-about ${className || ''}`.trim()} {...props}>
      <Box
        sx={{
          width: isSmall ? '70vmin' : '60vmin',
          maxWidth: '600px',
          textAlign: 'center',
          // mt: 6,
          mb: 4,
        }}
      >
        <Logo width={isSmall ? '70%' : '60%'} />
      </Box>
      <Typography component="p" sx={{ fontSize: 'small', textAlign: 'center' }} color="text.secondary">
        {t('version', { version: import.meta.env.VITE_APP_VERSION })}{' '}
        <Link href={CHANGELOG_URL} target="_blank" sx={{ ml: 1 }}>
          {t('whatsNew')}
        </Link>
      </Typography>
      <Typography component="nav" aria-label={tLegal('links.ariaLabel')} sx={{ fontSize: 'small', textAlign: 'center', mt: 1 }} color="text.secondary">
        <Link component={RouterLink} to="/privacy">
          {tLegal('privacy.title')}
        </Link>
        <Box component="span" aria-hidden="true" sx={{ mx: 1 }}>
          ·
        </Box>
        <Link component={RouterLink} to="/terms">
          {tLegal('terms.title')}
        </Link>
      </Typography>
    </Box>
  )
}
