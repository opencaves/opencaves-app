import { Button } from '@mui/material'
import { AddRounded } from '@mui/icons-material'

// The edit forms' "+ Add something" button, sized per M3's outlined button
// with a leading icon: 40dp tall (16dp before the icon, 24dp after the
// label), an 18dp icon, and a 48dp touch target that
// reaches 4dp past the top and bottom edges without being drawn - into the
// surrounding spacing (at least 16dp everywhere it's used), which M3 allows
// as long as it doesn't overlap another target, so no extra margin that
// would knock the layout off the 8dp grid. Pass
// startIcon for another leading icon (e.g. Add pictures' camera).
export default function AddButton({ className, sx, startIcon, children, ...props }) {
  return (
    <Button
      className={`oc-add-button${className ? ` ${className}` : ''}`}
      variant="outlined"
      startIcon={startIcon ?? <AddRounded />}
      sx={[
        {
          alignSelf: 'flex-start',
          position: 'relative',
          // The theme sizes buttons by line height and padding, which the
          // outlined variant's 1px border then adds to: take it back out so
          // the container is 40dp tall with 16dp/24dp inner spacing.
          lineHeight: '38px',
          pl: '23px',
          pr: '23px',
          '& .MuiButton-startIcon > :first-of-type': { fontSize: 18 },
          '&::before': { content: '""', position: 'absolute', left: 0, right: 0, top: -4, bottom: -4 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      {children}
    </Button>
  )
}
