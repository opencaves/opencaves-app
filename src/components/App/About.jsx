import { useTranslation } from 'react-i18next'
import { Box, Link, Typography } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import Logo from '@/images/logo/brand_light.svg?react'

export default function About({ className, ...props }) {
  const { t } = useTranslation('about')
  const isSmall = useSmall()

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
        {t('version', { version: import.meta.env.REACT_APP_VERSION })}{' '}
        <Link href="https://github.com/opencaves/opencaves-app/blob/main/CHANGELOG.md" target="_blank" sx={{ ml: 1 }}>
          {t('whatsNew')}
        </Link>
      </Typography>
    </Box>
  )
}
