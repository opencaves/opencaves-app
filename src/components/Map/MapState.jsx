import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Grid } from '@mui/material'
import { shellCaveName } from '@/utils/shell.js'
import '@/routes/NoMatch.scss'
import './MapState.scss'

/**
 * The map page while it loads: a still picture of it (the satellite map's
 * tone, its right-hand buttons, and on a cave's address its details pane),
 * the real page drawing itself over it - not a logo screen it would jump
 * from. index.html's splash (#oc-shell) draws the same before the app has
 * loaded: keep the two in step.
 */
export const MapLoading = forwardRef(function MapLoading(props, ref) {
  const withPane = /^\/map\/[^/]/.test(window.location.pathname)
  // The splash's cave name, kept: the page's first text stays put.
  const caveName = withPane ? shellCaveName() : undefined
  return (
    <div ref={ref} className={`oc-map-loading${withPane ? ' oc-map-loading--with-pane' : ''}`} aria-hidden="true">
      <div className="oc-map-loading--spinner">
        {[0, -111, -220].map((delay) => (
          <svg key={delay} className="oc-map-loading--spinner-dot" viewBox="0 0 64 64" style={{ animationDelay: `${delay}ms` }}>
            <circle transform="translate(32,32)" r="10"></circle>
          </svg>
        ))}
      </div>
      <span className="oc-map-loading--control oc-map-loading--account"></span>
      <span className="oc-map-loading--control oc-map-loading--layers"></span>
      <span className="oc-map-loading--control oc-map-loading--locate"></span>
      {withPane && (
        <div className="oc-map-loading--pane">
          <div className="oc-map-loading--cover"></div>
          <div className="oc-map-loading--head">
            <span className={`oc-map-loading--bar oc-map-loading--title${caveName ? ' oc-map-loading--named' : ''}`}>{caveName}</span>
            <span className="oc-map-loading--bar oc-map-loading--subtitle"></span>
          </div>
          <div className="oc-map-loading--actions">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="oc-map-loading--tabs">
            <span className="oc-map-loading--bar"></span>
            <span className="oc-map-loading--bar"></span>
            <span className="oc-map-loading--bar"></span>
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="oc-map-loading--row">
              <span className="oc-map-loading--bar"></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * The map failing: the "something went wrong" page's layout (the 404 page's,
 * with its own picture), offering to reload; the error itself in development.
 */
export function MapError({ error }) {
  const { t } = useTranslation('404')
  return (
    <Grid container className="oc-map-error no-match--container no-match--error" sx={{ flexDirection: 'column', position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}>
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
