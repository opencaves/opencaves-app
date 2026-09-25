import Button from '@mui/material/Button'

export default function AuthButton({ Component = Button, disabled, startIcon, endIcon, sx = {}, className, children, ...props }) {

  return (
    <Component
      variant='contained'
      className={`oc-auth-button ${className || ''}`.trim()}
      sx={{
        ...sx,
        '> .MuiButton-startIcon': {
          marginRight: '1em',
          '&.MuiButton-loadingPositionStart': {
            display: 'none'
          }
        },
        '> .MuiButton-loadingIndicator': {
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