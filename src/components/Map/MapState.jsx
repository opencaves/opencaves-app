import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Grid } from '@mui/material'
import { shellCaveName } from '@/utils/shell.js'
import { APP_NAME } from '@/config/app.js'
import '@/routes/NoMatch.scss'
import './MapState.scss'

// The OpenCaves mark, one colour (its two outer parts lighter): index.html's.
const MARK_PATHS = [
  ['p1', 'M76.57 55.43l-36.23-36L22 1.2A14.48 14.48 0 0 0 16.2 0C7.37 0 .19 8.1 0 18.16v43.47a18.67 18.67 0 0 0 18.43 18.91H69.2a17.86 17.86 0 0 0 10-15.92 17.4 17.4 0 0 0-2.63-9.19z'],
  ['p2', 'M73.76 19.46H23a17.86 17.86 0 0 0-10 15.92 17.46 17.46 0 0 0 2.61 9.2l36.23 36L70.23 98.8A14.52 14.52 0 0 0 76 100c8.82 0 16-8.09 16.19-18.15V38.36a18.67 18.67 0 0 0-18.43-18.9z'],
  ['p3', 'M15.61 44.58l36.23 36H69.2a17.86 17.86 0 0 0 10-15.92 17.4 17.4 0 0 0-2.62-9.19l-36.23-36H23a17.86 17.86 0 0 0-10 15.91 17.46 17.46 0 0 0 2.61 9.2z'],
]

/**
 * The map page while it loads: a still picture of it (its right-hand
 * buttons, and on a cave's address its details pane) over the other pages'
 * splash (their surface, the OpenCaves mark and the dots, in the part of
 * the map the pane leaves in sight), the real page drawing itself over it.
 * index.html's splash (#oc-shell) draws the same before the app has loaded:
 * keep the two in step.
 */
export const MapLoading = forwardRef(function MapLoading(props, ref) {
  const withPane = /^\/map\/[^/]/.test(window.location.pathname)
  // The splash's cave name, kept: the page's first text stays put.
  const caveName = withPane ? shellCaveName() : undefined
  return (
    <div ref={ref} className={`oc-map-loading${withPane ? ' oc-map-loading--with-pane' : ''}`} aria-hidden="true">
      <div className="oc-map-loading--splash">
        <div className="oc-map-loading--box">
          <svg className="oc-map-loading--logo" viewBox="-.0015623 -2.7662e-5 92.193 100">
            {MARK_PATHS.map(([part, d]) => (
              <path key={part} className={part} d={d} />
            ))}
          </svg>
          <div className="oc-map-loading--brand">{APP_NAME}</div>
          <div className="oc-map-loading--spinner">
            {[0, -111, -220].map((delay) => (
              <svg key={delay} className="oc-map-loading--spinner-dot" viewBox="0 0 64 64" style={{ animationDelay: `${delay}ms` }}>
                <circle transform="translate(32,32)" r="10"></circle>
              </svg>
            ))}
          </div>
        </div>
      </div>
      <span className="oc-map-loading--control oc-map-loading--account"></span>
      <span className="oc-map-loading--control oc-map-loading--layers"></span>
      <span className="oc-map-loading--control oc-map-loading--locate"></span>
      {withPane && (
        <div className="oc-map-loading--pane">
          <div className="oc-map-loading--cover"></div>
          {/* On the pane's ground: the name, the alias, the rating (a phone's close button). */}
          <div className="oc-map-loading--head">
            <span className={`oc-map-loading--bar oc-map-loading--title${caveName ? ' oc-map-loading--named' : ''}`}>{caveName}</span>
            <span className="oc-map-loading--bar oc-map-loading--subtitle"></span>
            <span className="oc-map-loading--bar oc-map-loading--stars"></span>
            <span className="oc-map-loading--close"></span>
          </div>
          {/* Its sections as cards: the quick actions, the media tabs, the place's rows. */}
          <div className="oc-map-loading--card oc-map-loading--actions">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="oc-map-loading--card oc-map-loading--tabs">
            <div className="oc-map-loading--tablist">
              <span className="oc-map-loading--bar"></span>
              <span className="oc-map-loading--bar"></span>
              <span className="oc-map-loading--bar"></span>
            </div>
            <span className="oc-map-loading--media"></span>
          </div>
          <div className="oc-map-loading--card oc-map-loading--rows">
            <span className="oc-map-loading--bar"></span>
            <span className="oc-map-loading--bar"></span>
            <span className="oc-map-loading--bar"></span>
          </div>
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
