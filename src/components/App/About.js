import { useTranslation } from 'react-i18next'
import { Box, Link, Typography } from '@mui/material'
import { useSmall } from '@/hooks/useSmall'
import { ReactComponent as Logo } from '@/images/logo/brand_light.svg'


export default function About(props) {
  const { t } = useTranslation('about')
  const isSmall = useSmall()

  return (
    <Box {...props}>
      <Box
        sx={{
          width: isSmall ? '70vmin' : '60vmin',
          maxWidth: '600px',
          textAlign: 'center',
          // mt: 6,
          mb: 4
        }}>
        <Logo
          width={isSmall ? '70%' : '60%'}
        />
      </Box>
      <Typography
        component='p'
        fontSize='small'
        textAlign='center'
        color='text.secondary'
      >
        {t('version', { version: process.env.REACT_APP_VERSION })} <Link href="https://github.com/opencaves/opencaves-app/blob/main/CHANGELOG.md" target='_blank' ml={1}>{t('whatsNew')}</Link>
      </Typography>
    </Box>
  )
}