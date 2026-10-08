import { useEffect, useRef, useState } from 'react'
import { Grid, IconButton, Tooltip } from '@mui/material'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { APP_TITLE } from '@/config/app.js'
import { setHeadLink, setHeadMeta } from '@/utils/headTags.js'
import { Link, isRouteErrorResponse, useLocation, useNavigate, useRevalidator, useRouteError } from 'react-router-dom'
import { Button } from '@mui/material'
import { useOnline } from '@/hooks/useOnline.jsx'
import { removeShell } from '@/utils/shell.js'
import './NoMatch.scss'

// The catch-all route's page, and every route's errorElement: a page that
// doesn't exist is "not found", but a page that failed to load (a loader or a
// code chunk failing, usually for want of a network) says so, and offers to
// try again rather than claiming the page doesn't exist.
// What went wrong, in development builds only: the URL, and the error's
// status and message, or its stack - production keeps the friendly page.
function DevDetails({ error }) {
  const { t } = useTranslation('404', { keyPrefix: 'devDetails' })
  const location = useLocation()
  const reason = !error
    ? t('noRoute')
    : isRouteErrorResponse(error)
      ? [`${error.status} ${error.statusText}`, typeof error.data === 'string' ? error.data : error.data && JSON.stringify(error.data, null, 2)].filter(Boolean).join('\n')
      : error.stack || error.message || String(error)
  const url = `${location.pathname}${location.search}${location.hash}`
  // Copy: the details as text (for a bug report), a check for a moment after.
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(null)
  useEffect(() => () => clearTimeout(copiedTimer.current), [])
  async function copy(event) {
    // Inside the summary: copying, not opening or closing the details.
    event.preventDefault()
    try {
      await navigator.clipboard.writeText(`${t('url')}: ${window.location.origin}${url}
${t('reason')}:
${reason}`)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch (copyError) {
      console.error(copyError)
    }
  }
  return (
    <details className="no-match--dev-details" open>
      <summary>
        <span>{t('title')}</span>
        <Tooltip title={copied ? t('copied') : t('copy')}>
          <IconButton className="no-match--copy" size="small" onClick={copy} aria-label={copied ? t('copied') : t('copy')}>
            {copied ? <CheckRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
          </IconButton>
        </Tooltip>
      </summary>
      <dl>
        <dt>{t('url')}</dt>
        <dd><code>{url}</code></dd>
        <dt>{t('reason')}</dt>
        <dd><pre>{reason}</pre></dd>
      </dl>
    </details>
  )
}

// inLayout: inside the pages' layout (app bar, search kept), not the whole
// window; a bad cave or system address offers its list too.
export default function NoMatch({ inLayout = false }) {
  const { t } = useTranslation('404')
  const { t: tHome } = useTranslation('home')
  const { pathname } = useLocation()
  const list = pathname.startsWith('/caves/') ? 'caves' : pathname.startsWith('/sistemas/') ? 'sistemas' : null
  const { t: tSeo } = useTranslation('seo')
  const error = useRouteError()
  const online = useOnline()
  const revalidator = useRevalidator()
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404)
  // offlinePreview: the development preview of the offline page
  // (/dev/error/offline), shown as offline while online.
  const kind = notFound ? 'notFound' : online && !error?.offlinePreview ? 'failed' : 'offline'
  const navigate = useNavigate()
  const { t: tApp } = useTranslation('app')
  // Back where the visitor came from; to the home page when this is the
  // first page (an installed app opened offline straight to it).
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  useEffect(() => {
    if (error && !notFound) console.error(error)
  }, [error, notFound])

  // An error page outside Layout (a route failing, the map's): index.html's
  // splash goes, as no page will remove it.
  useEffect(() => {
    removeShell()
  }, [])

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
    <Grid container className={`oc-no-match no-match--container${kind === 'notFound' ? '' : ' no-match--error'}${kind === 'offline' ? ' no-match--with-back' : ''}${inLayout ? ' no-match--in-layout' : ''}`} direction="column" sx={{ height: inLayout ? 'auto' : '100dvh', py: inLayout ? 6 : 0, justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
      {/* Offline: a way back to what's on the device (MD3: a full-screen
          view's back arrow at its top left), on a light disc over the photo. */}
      {kind === 'offline' && (
        <IconButton className="no-match--back" onClick={goBack} aria-label={tApp('back')} sx={{ position: 'fixed', top: 'calc(8px + env(safe-area-inset-top, 0px))', left: 8, width: 48, height: 48, bgcolor: 'var(--oc-page-surface)', '&:hover': { bgcolor: 'var(--oc-page-surface)' }, boxShadow: 2 }}>
          <ArrowBackRounded />
        </IconButton>
      )}
      <Grid className="no-match--box">
        <h1 className="no-match--header">{kind === 'notFound' ? t('header') : t(`${kind}.header`)}</h1>
        <p>{kind === 'notFound' ? t('description') : t(`${kind}.description`)}</p>
        {kind === 'notFound' ? (
          <Grid container sx={{ gap: 1.5, justifyContent: 'center' }}>
            {list && (
              <Button component={Link} variant="contained" disableElevation to={`/${list}`}>
                {tHome(`hero.browse.${list}`)}
              </Button>
            )}
            <Button component={Link} variant={list ? 'outlined' : 'contained'} disableElevation to="/">
              {t('backBtn')}
            </Button>
          </Grid>
        ) : (
          <Button variant="contained" disableElevation onClick={() => revalidator.revalidate()} loading={revalidator.state === 'loading'}>
            {t('retryBtn')}
          </Button>
        )}
        {import.meta.env.DEV && <DevDetails error={error} />}
      </Grid>
    </Grid>
    </>
  )
}
