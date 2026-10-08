import Button from '@mui/material/Button'
import { useOnline } from '@/hooks/useOnline.jsx'

// Disabled offline: signing in and up need the server (OfflineAuthNote says
// so). disabled: also busy - its spinner (loading) shows.
export default function AuthButton({ Component = Button, disabled, startIcon, endIcon, sx = {}, className, children, ...props }) {
  const online = useOnline()

  return (
    <Component
      variant='contained'
      className={`oc-auth-button ${className || ''}`.trim()}
      // An array: sx may be an object or a function of the theme (the
      // providers' colours, light and dark).
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        {
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
        },
      ]}
      disabled={disabled || !online}
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