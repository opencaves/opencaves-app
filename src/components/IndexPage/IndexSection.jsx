import { Box, Typography } from '@mui/material'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'

// A titled part of an index page (an area's cenotes, a system's
// connections...): an h2 with an optional count beside it. card: the content
// on an opaque card under the title (on a translucent page), outlined as the
// search field (an outlined input's border), the title then
// without its underline; cardSx: the card's own styles. lazy: laid out and
// painted only near the screen (content-visibility) - for the many sections
// of a long page. stickyTitle: the title stays in view under the page's
// search bar (--oc-index-search-height) while its section scrolls by, on the
// page's surface (what scrolls passes under it).
export default function IndexSection({ title, count, children, className, card = false, cardSx, lazy = false, stickyTitle = false }) {
  return (
    <Box component="section" className={['oc-index-section', className].filter(Boolean).join(' ')} sx={{ mb: card ? 3 : 4, ...(lazy && { contentVisibility: 'auto', containIntrinsicSize: 'auto 480px' }) }}>
      <Typography
        component="h2"
        variant="h6"
        sx={{
          mb: 1.5,
          pb: 0.5,
          ...(!card && { borderBottom: '1px solid', borderColor: 'divider' }),
          ...(card && { ml: 0.5 }),
          display: 'flex',
          alignItems: 'baseline',
          gap: 1,
          flexWrap: 'wrap',
          ...(stickyTitle && {
            position: 'sticky',
            // Under the app bar (64px) and the search field: a band across
            // the section, reaching up over the search bar's bottom padding
            // (12px, see-through) so nothing passing under shows between them.
            top: 'calc(64px + var(--oc-index-search-height, 0px) - 12px)',
            zIndex: 1,
            ml: 0,
            px: 1.5,
            pt: '16px',
            pb: 0.5,
            borderRadius: '0 0 8px 8px',
            bgcolor: 'var(--oc-page-surface)',
          }),
        }}
      >
        <span>{title}</span>
        {count != null && (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            {count}
          </Typography>
        )}
      </Typography>
      {card ? (
        <Box className="oc-index-section--card" sx={(theme) => ({ ...DASHBOARD_SURFACE_SX, border: `1px solid rgba(${theme.vars.palette.common.onBackgroundChannel} / 0.23)`, p: { xs: 2, sm: 3 }, ...cardSx })}>
          {children}
        </Box>
      ) : (
        children
      )}
    </Box>
  )
}
