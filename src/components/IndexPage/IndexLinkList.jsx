import { Link as RouterLink } from 'react-router-dom'
import { Box, Link } from '@mui/material'

// Links to cenotes or cave systems, in as many columns as the page's width
// holds (one on phones). items: { key, to, label, color, secondary } -
// color: a sistema's colour, as a dot before its name; secondary: muted
// text after the link (a cave's system).
export default function IndexLinkList({ items, className }) {
  return (
    <Box
      component="ul"
      className={['oc-index-link-list', className].filter(Boolean).join(' ')}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        columnWidth: '14rem',
        columnGap: 4,
        '& > li': { breakInside: 'avoid', py: 0.5 },
      }}
    >
      {items.map(({ key, to, label, color, secondary }) => (
        <li key={key}>
          <Link component={RouterLink} to={to} underline="hover" sx={{ typography: 'body1', display: 'inline-flex', alignItems: 'baseline', gap: 1, overflowWrap: 'anywhere' }}>
            {color && <Box component="span" aria-hidden="true" sx={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />}
            {label}
          </Link>
          {secondary && (
            <Box component="span" className="oc-index-link-list--secondary" sx={{ typography: 'body2', color: 'text.secondary', ml: 1 }}>
              {secondary}
            </Box>
          )}
        </li>
      ))}
    </Box>
  )
}
