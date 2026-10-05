import { Link } from 'react-router-dom'
import { Fab, Tooltip } from '@mui/material'

// A page's floating action button, as Material Design 3 places it: a 56dp
// FAB with 16dp corners, 16dp from the screen's bottom and right edges on
// phones (compact width), 24dp from 600px up, plus the device's safe area.
// to: a link; or onClick. label: its tooltip and accessible name.
export default function PageFab({ to, onClick, label, icon, className }) {
  const edge = (margin, side) => `calc(${margin}px + env(safe-area-inset-${side}, 0px))`
  return (
    <Tooltip title={label} placement="left">
      <Fab
        className={['oc-page-fab', className].filter(Boolean).join(' ')}
        color="primary"
        {...(to ? { component: Link, to } : { onClick })}
        aria-label={label}
        sx={{
          position: 'fixed',
          borderRadius: '16px',
          bottom: { xs: edge(16, 'bottom'), sm: edge(24, 'bottom') },
          right: { xs: edge(16, 'right'), sm: edge(24, 'right') },
        }}
      >
        {icon}
      </Fab>
    </Tooltip>
  )
}
