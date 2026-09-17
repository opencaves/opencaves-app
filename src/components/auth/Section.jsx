import { useEffect, useState } from 'react'
import { Fade, LinearProgress, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { gap } from '@/config/auth.js'

const width = {
  xs: '100%',
  sm: '42ch',
}

export function Section({ children, ...props }) {
  return (
    <Grid
      {...props}
      className="oc-auth-section"
      container
      direction="column"
      mb={{
        xs: 2,
        lg: 8,
      }}
      size="grow"
      sx={{ alignItems: 'center', alignContent: 'center', rowGap: gap }}
    >
      {children}
    </Grid>
  )
}

export function SectionDetails({ children, ...props }) {
  return (
    <Typography className="oc-auth-section-details" variant="body" component="p" my={0} mx={1.75} sx={{ textAlign: 'center' }} {...props}>
      {children}
    </Typography>
  )
}

export function SectionForm({ children, ...props }) {
  return (
    <Grid className="oc-auth-section-form" container direction="column" width={width} sx={{ rowGap: gap }} {...props}>
      {children}
    </Grid>
  )
}

export function SectionFields({ children, ...props }) {
  return (
    <Grid className="oc-auth-section-fields" container direction="column" size="grow" sx={{ pt: 0.75, rowGap: gap }} {...props}>
      {children}
    </Grid>
  )
}

export function SectionActions({ children, ...props }) {
  return (
    <Grid className="oc-auth-section-actions" container direction="column" mt={1} sx={{ alignItems: 'stretch', textAlign: 'center', rowGap: gap }} {...props}>
      {children}
    </Grid>
  )
}

export function Progress({ enabled = false }) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(enabled)
  }, [enabled])

  return (
    <Grid container direction="column" sx={{ alignItems: 'center', visibility: enabled ? 'visible' : 'hidden' }}>
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
