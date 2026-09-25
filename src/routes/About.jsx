import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid } from '@mui/material'
import About from '@/components/App/About.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

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
    <Grid className="oc-about" container direction="column" sx={{ height: '100%', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }}>
      <Grid>
        <About />
      </Grid>
    </Grid>
  )
}
