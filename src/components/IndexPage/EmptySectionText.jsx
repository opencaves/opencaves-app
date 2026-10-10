import { Typography } from '@mui/material'

/**
 * A section's line when it has nothing yet ("No photos yet."), above its Add
 * button - a sparse cave showed only the buttons.
 */
export default function EmptySectionText({ children }) {
  return (
    <Typography className="oc-empty-section-text" variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 1.5 }}>
      {children}
    </Typography>
  )
}
