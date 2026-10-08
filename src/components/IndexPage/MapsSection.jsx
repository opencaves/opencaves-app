import { useCallback } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Typography } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import mapsModel from '@/models/MapModel.js'
import { compareMapsByDate, getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import IndexSection from './IndexSection.jsx'
import Carousel from '@/components/Carousel/Carousel.jsx'
import Picture from '@/components/Picture.jsx'
import AddMapButton from '@/components/MapsPicker/AddMapButton.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import EmptySectionText from './EmptySectionText.jsx'

// Text under an item cut to two lines (with an ellipsis) on phones (MD3:
// brief text in carousels). Not the name on the map, on its own opaque band.
const TWO_LINES_ON_PHONES = { display: { xs: '-webkit-box', sm: 'block' }, WebkitLineClamp: { xs: 2, sm: 'none' }, WebkitBoxOrient: 'vertical', overflow: { xs: 'hidden', sm: 'visible' } }

// A system's survey maps (its own and those of the systems it joined, as the
// details pane's Maps tab), each with its date and who drew it. A map opens
// in the page's gallery (<pagePath>/maps/:id, MapGallery). A carousel on
// phones (a grid wider), its Show all pane with every map. Under them, the
// maps added offline still waiting to upload, and Add map (editors; the
// others are asked to log in) - shown with no map yet too, except to
// visitors where there's no system to add one to. pageMaps: every map, from
// the page that waited for them (its own query starts empty, drawing nothing
// for a moment, and the section then pushed the page down).
export default function MapsSection({ sistemaId, sistemas, connections, pagePath, title, card = false, pageMaps }) {
  const { t: tMaps } = useTranslation('mapsPicker')
  const [ownMaps, ownLoading] = mapsModel.useAll()
  const allMaps = pageMaps || ownMaps
  const loading = pageMaps ? false : ownLoading
  const isEditor = useSelector((state) => state.session.roles).includes('editor')
  const requireLogin = useRequireLogin('maps')
  const pendingMapsOf = useCallback((item) => item.kind === 'map' && item.sistemaId === sistemaId, [sistemaId])
  const byId = new Map(allMaps.map((map) => [map.id, map]))
  // Newest first, the undated last (as every list of maps).
  const maps = sistemaId ? getSistemaMapRefs(sistemaId, sistemas, connections).map(({ id }) => byId.get(id)).filter(Boolean).sort(compareMapsByDate) : []
  if (loading || (maps.length === 0 && !sistemaId && !isEditor)) return null

  return (
    <IndexSection id="maps" title={title} count={maps.length || undefined} className="oc-maps-section" card={card}>
      {maps.length === 0 && <EmptySectionText>{tMaps('empty.maps', { ns: 'indexPages' })}</EmptySectionText>}
      {maps.length > 0 && (
        <Carousel gridMinWidth="200px" label={title} bleed={card ? 2 : 0}>
          {maps.map((map) => {
            // Its year: maps' dates are "2000", "2012-10" or "1988-02-01".
            const year = map.date?.match(/\d{4}/)?.[0]
            const thumbnail = map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : null)
            const link = { component: RouterLink, to: `${pagePath}/maps/${map.id}`, state: { fromPage: true } }
            return (
              <li key={map.id}>
                <ButtonBase {...link} className="oc-maps-section--item" sx={{ display: 'block', width: '100%', textAlign: 'left', color: 'inherit', textDecoration: 'none', borderRadius: 2, '&:hover .oc-maps-section--thumbnail': { boxShadow: 2 }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
                  {/* The map's name and year over the bottom of its thumbnail, each
                      line on a dark band fitted to its text (inline, cloned on
                      every line), readable over any drawing. Opaque: at line
                      height 1 a wrapped name's bands overlap, which a
                      see-through band would show as a darker stripe. */}
                  <Box className="oc-maps-section--thumbnail oc-carousel--media" sx={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', transition: 'box-shadow 160ms ease' }}>
                    {thumbnail ? (
                      // Picture: a thumbnail not on the device offline says so.
                      <Picture src={thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : map.contentType === 'application/pdf' ? (
                      <PictureAsPdfRounded color="primary" fontSize="large" />
                    ) : (
                      <MapOutlined color="primary" fontSize="large" />
                    )}
                    <Box className="oc-maps-section--caption" sx={{ position: 'absolute', left: { xs: 12, sm: 8 }, right: { xs: 12, sm: 8 }, bottom: { xs: 12, sm: 8 }, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', '& span': { lineHeight: 1, px: '6px', py: '3px', color: 'common.white', bgcolor: 'rgb(32, 32, 32)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } }}>
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
                    <Typography variant="body2" className="oc-maps-section--cartography" sx={{ mt: 1, color: 'text.secondary', ...TWO_LINES_ON_PHONES }}>
                      {tMaps('cartography', { names: map.authors.join(', ') })}
                    </Typography>
                  )}
                </ButtonBase>
              </li>
            )
          })}
        </Carousel>
      )}
      <PendingUploadsStrip filter={pendingMapsOf} sx={{ mt: maps.length > 0 ? 2 : 0 }} />
      <AddMapButton sistemaId={sistemaId} canAdd={isEditor} onAddUnauthorized={requireLogin} spaced={maps.length > 0} />
    </IndexSection>
  )
}
