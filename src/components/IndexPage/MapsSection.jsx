import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import mapsModel from '@/models/MapModel.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import IndexSection from './IndexSection.jsx'

// A system's survey maps (its own and those of the systems it joined, as the
// details pane's Maps tab), each with its date and who drew it. A map opens
// in the map's viewer from `caveId` (one of the system's caves); without one,
// its file.
export default function MapsSection({ sistemaId, sistemas, connections, caveId, title, card = false }) {
  const { t: tMaps } = useTranslation('mapsPicker')
  const [allMaps] = mapsModel.useAll()
  const byId = new Map(allMaps.map((map) => [map.id, map]))
  const maps = sistemaId ? getSistemaMapRefs(sistemaId, sistemas, connections).map(({ id }) => byId.get(id)).filter(Boolean) : []
  if (maps.length === 0) return null

  return (
    <IndexSection title={title} count={maps.length} className="oc-maps-section" card={card}>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
        {maps.map((map) => {
          // Its year: maps' dates are "2000", "2012-10" or "1988-02-01".
          const year = map.date?.match(/\d{4}/)?.[0]
          const thumbnail = map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : null)
          const link = caveId ? { component: RouterLink, to: `/map/${caveId}/maps/${map.id}` } : { component: 'a', href: map.url, target: '_blank', rel: 'noopener' }
          return (
            <li key={map.id}>
              <Box {...link} className="oc-maps-section--item" sx={{ display: 'block', color: 'inherit', textDecoration: 'none', borderRadius: 2, '&:hover .oc-maps-section--thumbnail': { boxShadow: 2 }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
                {/* The map's name and year over the bottom of its thumbnail, each
                    line on a dark band fitted to its text (inline, cloned on
                    every line), readable over any drawing. Opaque: at line
                    height 1 a wrapped name's bands overlap, which a
                    see-through band would show as a darker stripe. */}
                <Box className="oc-maps-section--thumbnail" sx={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', transition: 'box-shadow 160ms ease' }}>
                  {thumbnail ? (
                    <Box component="img" src={thumbnail} alt="" loading="lazy" crossOrigin="anonymous" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : map.contentType === 'application/pdf' ? (
                    <PictureAsPdfRounded color="primary" fontSize="large" />
                  ) : (
                    <MapOutlined color="primary" fontSize="large" />
                  )}
                  <Box className="oc-maps-section--caption" sx={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', '& span': { lineHeight: 1, px: '6px', py: '3px', color: 'common.white', bgcolor: 'rgb(32, 32, 32)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } }}>
                    <Box sx={{ lineHeight: 1 }}>
                      <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.01em', overflowWrap: 'anywhere' }}>
                        {map.name}
                      </Typography>
                    </Box>
                    {year && (
                      <Typography component="span" sx={{ fontSize: '0.75rem', letterSpacing: '0.03em', color: 'rgba(255, 255, 255, 0.8) !important' }}>
                        {year}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {map.authors?.length > 0 && (
                  <Typography variant="body2" className="oc-maps-section--cartography" sx={{ mt: 1, color: 'text.secondary' }}>
                    {tMaps('cartography', { names: map.authors.join(', ') })}
                  </Typography>
                )}
              </Box>
            </li>
          )
        })}
      </Box>
    </IndexSection>
  )
}
