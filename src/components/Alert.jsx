import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { ReportProblemRounded } from '@mui/icons-material'

export function ErrorAlert({ open = false, onClose, header, hint, dismissLabel, children }) {
  const [errorAlertOpen, setErrorAlertOpen] = useState(false)

  function handleClose() {
    onClose()
  }

  useEffect(() => {
    if (open) {
      setErrorAlertOpen(open)
    }
  }, [open])

  return (
    <Dialog
      onClose={handleClose}
      open={errorAlertOpen}
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '1.5rem',
            textAlign: 'center',
          },
        },
      }}
    >
      <DialogContent sx={{ pt: 4 }}>
        <Grid container direction="column" sx={{ gap: 1, alignItems: 'center' }}>
          <ReportProblemRounded color="warning" sx={{ fontSize: '3rem', mb: 1 }} />
          {header && (
            <Typography variant="h5" component="p" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
              {header}
            </Typography>
          )}
          {children}
          {hint && (
            <Typography variant="body2" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <Button variant="contained" disableElevation onClick={handleClose} autoFocus>
          {dismissLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

ErrorAlert.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  header: PropTypes.node,
  hint: PropTypes.node,
  dismissLabel: PropTypes.node,
}
