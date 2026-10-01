import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Grid } from '@mui/material'
import Logo from '@/images/logo/logo-white.svg?react'
import '@/routes/NoMatch.scss'
import './MapState.scss'

export const MapLoading = forwardRef(function MapLoading(props, ref) {
  return (
    <div ref={ref} className="oc-map-loading">
      <div className="oc-map-loading--box">
        <Logo className="oc-map-loading--logo" />
        <h1>Open Caves</h1>
        <div className="oc-map-loading--spinner">
          <svg className="oc-map-loading--spinner-dot spinner-dot-1" viewBox="0 0 64 64" style={{ animationDelay: '0', animationDuration: '750ms' }}>
            <circle transform="translate(32,32)" r="10"></circle>
          </svg>
          <svg className="oc-map-loading--spinner-dot spinner-dot-2" viewBox="0 0 64 64" style={{ animationDelay: '-111ms', animationDuration: '750ms' }}>
            <circle transform="translate(32,32)" r="10"></circle>
          </svg>
          <svg className="oc-map-loading--spinner-dot spinner-dot-3" viewBox="0 0 64 64" style={{ animationDelay: '-220ms', animationDuration: '750ms' }}>
            <circle transform="translate(32,32)" r="10"></circle>
          </svg>
        </div>
      </div>
    </div>
  )
})

// The map failing: the "something went wrong" page's layout (the 404 page's,
// with its own picture), offering to reload; the error itself in development.
export function MapError({ error }) {
  const { t } = useTranslation('404')
  return (
    <Grid container className="oc-map-error no-match--container no-match--error" direction="column" sx={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}>
      <Grid className="no-match--box">
        <h1 className="no-match--header">{t('failed.header')}</h1>
        <p>{t('failed.description')}</p>
        <Button variant="contained" disableElevation onClick={() => window.location.reload()}>
          {t('retryBtn')}
        </Button>
        {import.meta.env.DEV && error?.stack && (
          <details className="no-match--dev-details" open>
            <summary>{t('devDetails.title')}</summary>
            <pre>{error.stack}</pre>
          </details>
        )}
      </Grid>
    </Grid>
  )
}
