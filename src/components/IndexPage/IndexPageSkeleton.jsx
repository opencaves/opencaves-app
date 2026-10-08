import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
import { useFillHeight } from '@/components/Skeletons/useFillHeight.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'

const cardSx = { ...DASHBOARD_SURFACE_SX, p: { xs: 2, sm: 3 } }

// An index page while the cave data loads (a first visit): its breadcrumb
// and heading, then its content on cards, as the page draws them.
// - item: a cave's or a system's own page (CavePage, SistemaPage) - the "On
//   the map" button, the facts card, then titled cards (access, photos...);
//   otherwise a list page (/caves, /sistemas, an area): titled sections of
//   links in columns (IndexLinkList)
// - search: the list page's search field above its sections (/caves, /sistemas)
// - card: each section's links on an opaque card (/caves, /sistemas, one per
//   area), else under an underlined title, a map icon ending each link (an
//   area's page)
// - back: a back arrow before the title (IndexPageHeader's backTo)
// - onMap: the "On the map" button under the heading (a cave's page)
export default function IndexPageSkeleton({ item = false, search = false, card = false, back = false, onMap = false }) {
  return (
    <Box className="oc-index-page-skeleton">
      <Box aria-hidden="true" sx={{ mb: 3 }}>
        <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 140, mb: 3 }} />
        {/* The back arrow, in the margin above phone width (IndexPageHeader). */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {back && <Skeleton variant="circular" width={24} height={24} sx={{ flexShrink: 0, mx: 1, ml: { xs: 1, sm: -3 }, mr: 0.5 }} />}
          <Skeleton variant="text" sx={{ ...PAGE_TITLE_SX, width: 'min(100%, 420px)' }} />
        </Box>
        <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 120, ml: back ? { xs: 6, sm: 0 } : 0 }} />
      </Box>
      {item ? <ItemSkeleton onMap={onMap} /> : <LinksSkeleton search={search} card={card} />}
    </Box>
  )
}

function ItemSkeleton({ onMap }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref)
  return (
    <Box ref={ref} aria-busy="true" sx={{ height: height ?? '100vh', overflow: 'hidden' }}>
      <Box component="span" role="status" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {t('loading')}
      </Box>
      <Box aria-hidden="true">
        {onMap && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Skeleton variant="rounded" sx={{ width: 150, height: 36, borderRadius: 5 }} />
          </Box>
        )}
        {/* The facts: label, value. */}
        <Box sx={{ ...cardSx, mb: 3, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1 }}>
          {[45, 30, 55].map((width, i) => (
            <Box key={i} sx={{ display: 'contents' }}>
              <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 70 }} />
              <Skeleton variant="text" sx={{ fontSize: '1rem', width: `${width}%` }} />
            </Box>
          ))}
        </Box>
        {/* Titled sections, each on its card: text lines. */}
        {[3, 5, 4, 4].map((lines, section) => (
          <Box key={section} sx={{ mb: 3 }}>
            <Skeleton variant="text" sx={{ fontSize: '1.25rem', width: [100, 130, 90, 150][section], mb: 1.5, ml: 0.5 }} />
            <Box sx={cardSx}>
              {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} variant="text" sx={{ fontSize: '1rem', width: i === lines - 1 ? '60%' : '100%' }} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// Links per section, cycled, so the sections don't all look alike.
const SECTION_SIZES = [14, 6, 10, 4]

function LinksSkeleton({ search, card }) {
  const { t } = useTranslation('app')
  const ref = useRef(null)
  const height = useFillHeight(ref)
  return (
    <Box ref={ref} aria-busy="true" sx={{ height: height ?? '100vh', overflow: 'hidden' }}>
      <Box component="span" role="status" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {t('loading')}
      </Box>
      <Box aria-hidden="true">
        {search && <Skeleton variant="rounded" sx={{ height: 40, borderRadius: 5, mb: 3 }} />}
        {SECTION_SIZES.map((size, section) => (
          <Box key={section} sx={{ mb: card ? 3 : 4 }}>
            {/* The section's title and count (IndexSection). */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, pb: 0.5, ...(card ? { ml: 0.5 } : { borderBottom: 1, borderColor: 'divider' }) }}>
              <Skeleton variant="text" sx={{ fontSize: '1.25rem', width: [110, 140, 90, 160][section] }} />
              <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 50 }} />
            </Box>
            {/* The links, in as many columns as fit (IndexLinkList). */}
            <Box sx={{ ...(card && cardSx), columnWidth: '15rem', columnGap: 2 }}>
              {Array.from({ length: size }, (_, i) => (
                <Box key={i} sx={{ breakInside: 'avoid', minHeight: 40, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" sx={{ fontSize: '1rem', width: `${[60, 45, 75, 55, 40, 70][(i + section) % 6]}%` }} />
                  {/* The map icon: always shown on touch screens, on hover otherwise. */}
                  {!card && <Skeleton variant="rounded" width={20} height={20} sx={{ mr: 0.5, '@media (hover: hover)': { display: 'none' } }} />}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
