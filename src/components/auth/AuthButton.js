import { LoadingButton } from '@mui/lab'
// import { Button } from '@mui/material'

export default function AuthButton({ Component = LoadingButton, disabled, startIcon, endIcon, sx = {}, children, ...props }) {

  return (
    <Component
      variant='contained'
      sx={{
        ...sx,
        '> .MuiButton-startIcon': {
          marginRight: '1em',
          '&.MuiLoadingButton-startIconLoadingStart': {
            display: 'none'
          }
        },
        '> .MuiLoadingButton-loadingIndicator': {
          position: 'unset',
          marginRight: '1em'
        }
      }}
      disabled={disabled}
      loading={disabled}
      startIcon={startIcon}
      endIcon={endIcon}
      loadingPosition={startIcon ? 'start' : endIcon ? 'end' : undefined}
      {...props}
    >
      <span>{children}</span>
    </Component>
  )
}