import { Box, Typography } from '@mui/material'

// A titled part of an index page (an area's cenotes, a system's
// connections...): an h2 with an optional count beside it.
export default function IndexSection({ title, count, children, className }) {
  return (
    <Box component="section" className={['oc-index-section', className].filter(Boolean).join(' ')} sx={{ mb: 4 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 1.5, pb: 0.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <span>{title}</span>
        {count != null && (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            {count}
          </Typography>
        )}
      </Typography>
      {children}
    </Box>
  )
}
