
import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Grid from '@mui/material/Unstable_Grid2'
import About from '@/components/App/About'
import { useTitle } from '@/hooks/useTitle'

export default function AboutRoute() {

  const { t } = useTranslation('about')
  const { setTitle } = useTitle()
  const matches = useMatches()

  useEffect(() => {
    console.log('matches: %o', matches)
    if (matches.length === 2) {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  return (
    <Grid
      container
      direction='column'
      flexWrap='nowrap'
      alignItems='center'
      height='100%'
      justifyContent='center'
    >
      <Grid>
        <About />
      </Grid>
    </Grid>
  )
}