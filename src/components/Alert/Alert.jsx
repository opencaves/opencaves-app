import { Box } from '@mui/material'
import { Grid } from '@mui/material'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningRounded from '@mui/icons-material/WarningRounded'

/**
 * A message with its icon: a check, or a warning for an error.
 *
 * @param {object} props
 * @param {React.ReactNode} props.message
 * @param {React.ReactNode} [props.footer] - Under the message.
 * @param {'success'|'error'} [props.type] - The icon: a check unless 'error'.
 * @param {string} [props.fontSize='1rem']
 */
export default function Message({ message, footer, type, fontSize }) {
  return (
    <Box
      className="oc-alert-message"
      sx={{
        mr: 3,
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
