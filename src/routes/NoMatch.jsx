import { useEffect } from 'react'
import { Grid } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { APP_TITLE } from '@/config/app.js'
import { setHeadLink, setHeadMeta } from '@/utils/headTags.js'
import { Link, isRouteErrorResponse, useRevalidator, useRouteError } from 'react-router-dom'
import { Button } from '@mui/material'
import { useOnline } from '@/hooks/useOnline.jsx'
import './NoMatch.scss'

// The catch-all route's page, and every route's errorElement: a page that
// doesn't exist is "not found", but a page that failed to load (a loader or a
// code chunk failing, usually for want of a network) says so, and offers to
// try again rather than claiming the page doesn't exist.
export default function NoMatch() {
  const { t } = useTranslation('404')
  const { t: tSeo } = useTranslation('seo')
  const error = useRouteError()
  const online = useOnline()
  const revalidator = useRevalidator()
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404)
  const kind = notFound ? 'notFound' : online ? 'failed' : 'offline'

  useEffect(() => {
    if (error && !notFound) console.error(error)
  }, [error, notFound])

  useEffect(() => {
    setHeadMeta('robots', 'noindex')
    setHeadLink('canonical', null)
    return () => setHeadMeta('robots', null)
  }, [])

  // Back online: try loading the page again on its own.
  useEffect(() => {
    if (online && !notFound && revalidator.state === 'idle') revalidator.revalidate()
    // Only on going back online, not on every revalidator change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  return (
    <>
    {/* Its own title (the previous page's would otherwise linger) and
        noindex: the SPA can't send a real 404 status, so tell crawlers
        directly not to index this as a page. */}
    <Helmet>
      <title>{`${kind === 'notFound' ? tSeo('notFoundTitle') : t(`${kind}.header`)} / ${APP_TITLE}`}</title>
    </Helmet>
    <Grid container className="oc-no-match no-match--container" direction="column" sx={{ height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <Grid className="no-match--box">
        <h1 className="no-match--header">{kind === 'notFound' ? t('header') : t(`${kind}.header`)}</h1>
        <p>{kind === 'notFound' ? t('description') : t(`${kind}.description`)}</p>
        {kind === 'notFound' ? (
          <Button component={Link} variant="contained" disableElevation to="/">
            {t('backBtn')}
          </Button>
        ) : (
          <Button variant="contained" disableElevation onClick={() => revalidator.revalidate()} loading={revalidator.state === 'loading'}>
            {t('retryBtn')}
          </Button>
        )}
      </Grid>
    </Grid>
    </>
  )
}
