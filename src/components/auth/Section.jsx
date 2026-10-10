import { useEffect, useState } from 'react'
import { Fade, LinearProgress, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { AUTH_SECTION_GAP } from '@/config/auth.js'

const width = {
  xs: '100%',
  sm: '42ch',
}

/**
 * A step of an auth form: a centred column.
 *
 * @param {import('@mui/material/Grid').GridProps} props
 */
export function Section({ children, className, ...props }) {
  return (
    <Grid
      {...props}
      className={`oc-section oc-auth-section ${className || ''}`.trim()}
      container
      size="grow"
      sx={{
        flexDirection: 'column',
        mb: {
          xs: 2,
          lg: 8,
        },
        alignItems: 'center',
        alignContent: 'center',
        rowGap: AUTH_SECTION_GAP,
      }}
    >
      {children}
    </Grid>
  )
}

/**
 * A section's text, centred.
 *
 * @param {import('@mui/material/Typography').TypographyProps} props
 */
export function SectionDetails({ children, ...props }) {
  return (
    <Typography className="oc-section-details oc-auth-section-details" variant="inherit" component="p" sx={{ my: 0, mx: 1.75, textAlign: 'center' }} {...props}>
      {children}
    </Typography>
  )
}

/**
 * A section's form: its fields and actions.
 *
 * @param {import('@mui/material/Grid').GridProps} props
 */
export function SectionForm({ children, ...props }) {
  return (
    <Grid className="oc-section-form oc-auth-section-form" container sx={{ flexDirection: 'column', width, rowGap: AUTH_SECTION_GAP }} {...props}>
      {children}
    </Grid>
  )
}

/**
 * A section's fields, in a column.
 *
 * @param {import('@mui/material/Grid').GridProps} props
 */
export function SectionFields({ children, ...props }) {
  return (
    <Grid className="oc-section-fields oc-auth-section-fields" container size="grow" sx={{ flexDirection: 'column', pt: 0.75, rowGap: AUTH_SECTION_GAP }} {...props}>
      {children}
    </Grid>
  )
}

/**
 * A section's buttons, in a column.
 *
 * @param {import('@mui/material/Grid').GridProps} props
 */
export function SectionActions({ children, ...props }) {
  return (
    <Grid className="oc-section-actions oc-auth-section-actions" container sx={{ flexDirection: 'column', mt: 1, alignItems: 'stretch', textAlign: 'center', rowGap: AUTH_SECTION_GAP }} {...props}>
      {children}
    </Grid>
  )
}

/**
 * A section's progress bar, its room kept while hidden.
 *
 * @param {object} props
 * @param {boolean} [props.enabled=false] - Shown (busy).
 */
export function Progress({ enabled = false }) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(enabled)
  }, [enabled])

  return (
    <Grid className="oc-progress" container sx={{ flexDirection: 'column', alignItems: 'center', visibility: enabled ? 'visible' : 'hidden' }}>
      <Grid
        sx={{
          width,
        }}
      >
        <Fade
          in={loading}
          style={{
            transitionDelay: loading ? '800ms' : '0ms',
          }}
          // unmountOnExit
        >
          <LinearProgress sx={{ height: 2 }} />
        </Fade>
      </Grid>
    </Grid>
  )
}
