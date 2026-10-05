import { useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Button, Stack, Typography } from '@mui/material'
import MapRounded from '@mui/icons-material/MapRounded'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import Logo from '@/images/logo/brand_light.svg?react'
import './Home.scss'

// / - the landing page. A first version (the logo, a line, the ways in: the
// map, the caves, the cave systems) until its content is settled.
export default function Home() {
  const { t } = useTranslation('home')
  const { setTitle } = useTitle()
  const isSmall = useSmall()

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return (
    <Box className="oc-home" sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 6 }}>
      <Typography component="h1" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {t('title')}
      </Typography>
      <Box sx={{ width: isSmall ? '70vmin' : '40vmin', maxWidth: 420, mb: 3 }}>
        <Logo width="100%" />
      </Box>
      <Typography variant="h6" component="p" sx={{ maxWidth: 560, mb: 4, color: 'text.secondary', fontWeight: 400 }}>
        {t('tagline')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
        <Button className="oc-home--map" variant="contained" size="large" component={RouterLink} to="/map" startIcon={<MapRounded />}>
          {t('openMap')}
        </Button>
        <Button className="oc-home--caves" variant="outlined" size="large" component={RouterLink} to="/caves">
          {t('browseCaves')}
        </Button>
        <Button className="oc-home--sistemas" variant="outlined" size="large" component={RouterLink} to="/sistemas">
          {t('browseSistemas')}
        </Button>
      </Stack>
    </Box>
  )
}
