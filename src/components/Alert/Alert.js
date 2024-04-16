import { Box } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { CheckCircleOutlineRounded, WarningRounded } from '@mui/icons-material'

/**
 * The type of an alert
 * @typedef {(success|error)} Alert
 */

/**
 * 
 * @param {string} [success] props.type 
 */
export default function Message({ message, footer, type, fontSize }) {
  return (
    <Box
      mr={3}
      sx={{
        fontSize: fontSize ?? '1rem',
        lineHeight: 1
      }}
    >
      <Grid
        container
        direction='row'
        flexWrap='nowrap'
        alignItems='center'
      >
        <Grid
          container
          direction='column'
        >
          {
            type === 'error' ? (
              <WarningRounded color='warning' sx={{ mr: 1.5, fontSize: '1.5em' }} />
            ) : (
              <CheckCircleOutlineRounded color='success' sx={{ mr: 1.5, fontSize: '1.5em' }} />
            )
          }
        </Grid>
        <Grid xs>{message}</Grid>
      </Grid>
      {
        footer
      }
    </Box>
  )
}