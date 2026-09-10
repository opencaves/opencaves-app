import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material'
import Grid from '@mui/material/Grid'
import { WarningRounded } from '@mui/icons-material'


export function ErrorAlert({ open = false, onClose, children }) {
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
    <Dialog onClose={handleClose} open={errorAlertOpen}>
      <DialogContent>
        <Grid container direction='column' gap={2}>
          <Grid xs alignSelf='center'>
            <WarningRounded color='error' fontSize='large' />
          </Grid>
          <Grid>
            {children}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} autoFocus>Ok</Button>
      </DialogActions>
    </Dialog>
  )
}

ErrorAlert.propTypes = {
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
}