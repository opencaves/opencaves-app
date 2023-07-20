// import { useEffect } from 'react'
import Grid from '@mui/material/Unstable_Grid2'
import { SvgIcon, Typography, useMediaQuery } from '@mui/material'
import { useTitle } from '../../hooks/useTitle'
import { ReactComponent as Logo } from '../../images/logo/logo-dark.svg'

export default function TitleBar() {

  const { title } = useTitle()

  const isWindowControlsOverlayVisible = useMediaQuery('(display-mode: window-controls-overlay)')

  // useEffect(() => {
  //   console.log('isWindowControlsOverlayVisible: %s', isWindowControlsOverlayVisible)
  // }, [isWindowControlsOverlayVisible])

  return isWindowControlsOverlayVisible && (
    <Grid
      container
      sx={{
        position: 'absolute',
        margin: 0,
        left: 'env(titlebar-area-x, 0)',
        top: 'env(titlebar-area-y, 0)',
        width: 'env(titlebar-area-width, 100%)',
        height: 'env(titlebar-area-height, var(--oc-titlebar-default-height))',
        bgcolor: 'primary.main',
        '-webkitAppRegion': 'drag',
        appRegion: 'drag',
        '& + *': {
          position: 'absolute',
          top: 'env(titlebar-area-height, var(--oc-titlebar-default-height))',
          left: 0,
          right: 0,
          bottom: 0,
        }
      }}
    >
      <Grid
        container
        alignItems='center'
      >
        <SvgIcon
          component={Logo}
          inheritViewBox
          sx={{
            ml: 1
          }}
        />
      </Grid>
      <Grid
        container
        alignItems='center'
      >
        <Typography
          variant='titlebarTitle'
          sx={{
            ml: 1
          }}
        >
          {title}
        </Typography>
      </Grid>
      <Grid alignItems='center' xs></Grid>
    </Grid>
  )
}