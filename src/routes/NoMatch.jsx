import { useEffect } from 'react'
import { Grid } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { appTitle } from '@/config/app.js'
import { setHeadLink, setHeadMeta } from '@/utils/headTags.js'
import { Link } from 'react-router-dom'
import { Button, useTheme } from '@mui/material'
import './NoMatch.scss'

export default function NoMatch() {
  const { t } = useTranslation('404')
  const { t: tSeo } = useTranslation('seo')
  const theme = useTheme()

  useEffect(() => {
    setHeadMeta('robots', 'noindex')
    setHeadLink('canonical', null)
    return () => setHeadMeta('robots', null)
  }, [])

  return (
    <>
    {/* Its own title (the previous page's would otherwise linger) and
        noindex: the SPA can't send a real 404 status, so tell crawlers
        directly not to index this as a page. */}
    <Helmet>
      <title>{`${tSeo('notFoundTitle')} / ${appTitle}`}</title>
    </Helmet>
    <Grid container className="oc-no-match no-match--container" direction="column" sx={{ height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <Grid className="no-match--box">
        <h1 className="no-match--header">{t('header')}</h1>
        <p>{t('description')}</p>
        <Button component={Link} variant="contained" disableElevation to="/">
          {t('backBtn')}
        </Button>
      </Grid>
    </Grid>
    </>
  )
}
