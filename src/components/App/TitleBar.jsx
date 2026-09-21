// import { useEffect } from 'react'
import { Grid } from '@mui/material'
import { Typography, useMediaQuery } from '@mui/material'
import LogoIcon from './LogoIcon.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function TitleBar() {
  const { title } = useTitle()

  const isWindowControlsOverlayVisible = useMediaQuery('(display-mode: window-controls-overlay)')

  // useEffect(() => {
  //   console.log('isWindowControlsOverlayVisible: %s', isWindowControlsOverlayVisible)
  // }, [isWindowControlsOverlayVisible])

  return (
    isWindowControlsOverlayVisible && (
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
          },
        }}
      >
        <Grid container sx={{ alignItems: 'center' }}>
          <LogoIcon
            colorScheme="dark"
            sx={{
              ml: 1,
            }}
          />
        </Grid>
        <Grid container sx={{ alignItems: 'center' }}>
          <Typography
            variant="titlebarTitle"
            sx={{
              ml: 1,
            }}
          >
            {title}
          </Typography>
        </Grid>
        <Grid sx={{ alignItems: 'center', flex: 1 }}></Grid>
      </Grid>
    )
  )
}
