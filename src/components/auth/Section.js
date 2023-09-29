import { Fade, LinearProgress, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { gap } from '@/config/auth'
import { useEffect, useState } from 'react'

const width = {
  xs: '100%',
  sm: '42ch'
}

export function Section({ children, ...props }) {

  return (
    <Grid
      {...props}
      className='oc-auth-section'
      container
      direction='column'
      alignContent='center'
      alignItems='center'
      mb={{
        xs: 2,
        lg: 8
      }}
      xs
      rowGap={gap}
    >
      {children}
    </Grid>
  )
}

export function SectionDetails({ children, ...props }) {
  return (

    <Typography
      className='oc-auth-section-details'
      variant='body'
      textAlign='center'
      my={0}
      mx={1.75}
      paragraph
      {...props}
    >
      {children}
    </Typography>
  )
}

export function SectionForm({ children, ...props }) {
  return (
    <Grid
      className='oc-auth-section-form'
      container
      direction='column'
      rowGap={gap}
      width={width}
      {...props}
    >
      {children}
    </Grid>
  )
}

export function SectionFields({ children, ...props }) {
  return (
    <Grid
      className='oc-auth-section-fields'
      container
      direction='column'
      xs
      rowGap={gap}
      sx={{ pt: .75 }}
      {...props}
    >
      {children}
    </Grid>
  )
}

export function SectionActions({ children, ...props }) {
  return (
    <Grid
      className='oc-auth-section-actions'
      container
      direction='column'
      rowGap={gap}
      alignItems='stretch'
      textAlign='center'
      mt={1}
      {...props}
    >
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

    <Grid
      container
      direction='column'
      alignItems='center'
      sx={{ visibility: enabled ? 'visible' : 'hidden' }}
    >
      <Grid
        sx={{
          width
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