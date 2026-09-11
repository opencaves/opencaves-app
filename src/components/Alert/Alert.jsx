import { Box } from '@mui/material'
import { Grid } from '@mui/material'
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
        lineHeight: 1,
      }}
    >
      <Grid container direction="row" sx={{ flexWrap: 'nowrap', alignItems: 'center' }}>
        <Grid container direction="column">
          {type === 'error' ? <WarningRounded color="warning" sx={{ mr: 1.5, fontSize: '1.5em' }} /> : <CheckCircleOutlineRounded color="success" sx={{ mr: 1.5, fontSize: '1.5em' }} />}
        </Grid>
        <Grid size="grow">{message}</Grid>
      </Grid>
      {footer}
    </Box>
  )
}
