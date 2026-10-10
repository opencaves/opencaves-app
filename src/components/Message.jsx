import { Box } from '@mui/material'
import { Grid } from '@mui/material'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningRounded from '@mui/icons-material/WarningRounded'

/**
 * A message beside a success (or, for type 'error', a warning) icon.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.message
 * @param {import('react').ReactNode} [props.footer] - Under it.
 * @param {string} [props.type] - 'error' for the warning icon.
 * @param {string | number} [props.fontSize='1rem']
 */
export default function Message({ message, footer, type, fontSize }) {
  return (
    <Box
      className="oc-message"
      sx={{
        mr: 3,
        fontSize: fontSize ?? '1rem',
        lineHeight: 1,
      }}
    >
      <Grid container direction="row" sx={{ flexWrap: 'nowrap', alignItems: 'center' }}>
        <Grid container sx={{ flexDirection: 'column' }}>
          {type === 'error' ? <WarningRounded color="warning" sx={{ mr: 1.5, fontSize: '1.5em' }} /> : <CheckCircleOutlineRounded color="success" sx={{ mr: 1.5, fontSize: '1.5em' }} />}
        </Grid>
        <Grid size="grow">{message}</Grid>
      </Grid>
      {footer}
    </Box>
  )
}
