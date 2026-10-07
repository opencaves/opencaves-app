import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Link, Typography } from '@mui/material'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'

// A titled part of an index page (an area's cenotes, a system's
// connections...): an h2 with an optional count beside it. card: the content
// on an opaque card under the title (on a translucent page), outlined as the
// search field (an outlined input's border), the title then
// without its underline; cardSx: the card's own styles. lazy: laid out and
// painted only near the screen (content-visibility) - for the many sections
// of a long page. stickyTitle: the title stays in view under the page's
// search bar (--oc-index-search-height) while its section scrolls by, on the
// page's surface (what scrolls passes under it). id: the section's anchor (in
// English, the same in every language: #photos, #maps...) - an address ending
// with it scrolls there (Layout), and a # beside the title links to it.
// A section with an anchor: clear of the fixed app bar (and a sticky title)
// when scrolled to; its # shown while the title is hovered or focused.
const SECTION_ANCHOR_SX = {
  scrollMarginTop: 'calc(64px + var(--oc-index-search-height, 0px) + 8px)',
  '& .oc-index-section--anchor': { opacity: 0, color: 'text.secondary', fontWeight: 400, transition: 'opacity 150ms' },
  '& h2:hover .oc-index-section--anchor, & .oc-index-section--anchor:focus-visible': { opacity: 1 },
}

export default function IndexSection({ id, title, count, children, className, card = false, cardSx, lazy = false, stickyTitle = false }) {
  const { t } = useTranslation('indexPages')
  return (
    <Box component="section" id={id} className={['oc-index-section', className].filter(Boolean).join(' ')} sx={{ mb: card ? 3 : 4, ...(lazy && { contentVisibility: 'auto', containIntrinsicSize: 'auto 480px' }), ...(id && SECTION_ANCHOR_SX) }}>
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
            borderRadius: '8px',
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
        {id && (
          <Link component={RouterLink} to={{ hash: id }} className="oc-index-section--anchor" aria-label={t('sectionLink', { name: typeof title === 'string' ? title : id })} underline="none">
            #
          </Link>
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
