import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Grid } from '@mui/material'
import About from '@/components/App/About.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function AboutRoute() {
  const { t } = useTranslation('about')
  const { setTitle } = useTitle()
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname.replace(/\/$/, '') === '/about') {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, t])

  return (
    <Grid className="oc-about" container direction="column" sx={{ height: '100%', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }}>
      {/* The page's h1 (the logo is its visual heading). */}
      <Box component="h1" sx={{ position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
        {t('title')}
      </Box>
      <Grid>
        <About />
      </Grid>
    </Grid>
  )
}
