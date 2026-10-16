import { useCallback } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Typography } from '@mui/material'
import MapRounded from '@mui/icons-material/MapRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import mapsModel from '@/models/MapModel.js'
import { getSistemaMapRefs, orderSistemaMaps } from '@/utils/sistemaMaps.js'
import { useMapReorder } from '@/hooks/useMapReorder.js'
import IndexSection from './IndexSection.jsx'
import MediaStrip from '@/components/ResultPane/MediaStrip.jsx'
import { PAGE_STRIP } from '@/config/resultPane.js'
import StripShowAll from '@/components/ResultPane/StripShowAll.jsx'
import Picture from '@/components/Picture.jsx'
import AddMapButton from '@/components/MapsPicker/AddMapButton.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import EmptySectionText from './EmptySectionText.jsx'
import CardOptionsMenu from '@/components/ResultPane/CardOptionsMenu.jsx'
import { useCanTrashMaps, useTrashMapConfirm } from '@/components/MapPane/TrashMap.jsx'
import { downloadName, useMediaActionsFor, withOthers } from '@/components/MediaPane/menuItems/mediaActions.jsx'
import { SITE_URL } from '@/config/app.js'


/**
 * A system's survey maps (its own and those of the systems it joined, as the
 * details pane's Maps tab), each with its date and who drew it. A map opens
 * in the page's gallery (<pagePath>/maps/:id, MapGallery). On a 3D strip
 * ({@link MediaStrip}, as the map's cave pane), each map a tile: its
 * thumbnail, its name and year over it ({@link MapThumbnail}); then
 * Show all under it ({@link StripShowAll}) opening every one in a grid.
 * Each map's menu ({@link CardOptionsMenu}): Share, Download and Report this
 * map for everyone ({@link useMediaActionsFor}); Edit for editors, Delete for
 * admins. Under them, the
 * maps added offline still waiting to upload, and Add map (editors; the
 * others are asked to log in) - shown with no map yet too, except to
 * visitors where there's no system to add one to.
 *
 * @param {object} props
 * @param {string} props.sistemaId - The system whose maps it shows (with those of the systems it joined).
 * @param {Sistema[]} props.sistemas
 * @param {Connection[]} props.connections
 * @param {string} props.pagePath - The page's address, its gallery's base.
 * @param {string} props.title
 * @param {boolean} [props.card=false] - IndexSection's.
 * @param {CaveMap[]} [props.pageMaps] - Every map, from
 *   the page that waited for them (its own query starts empty, drawing nothing
 *   for a moment, and the section then pushed the page down).
 */
export default function MapsSection({ sistemaId, sistemas, connections, pagePath, title, card = false, pageMaps }) {
  const { t: tMaps } = useTranslation('mapsPicker')
  const [ownMaps, ownLoading] = mapsModel.useAll()
  const allMaps = pageMaps || ownMaps
  const loading = pageMaps ? false : ownLoading
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const requireLogin = useRequireLogin('maps')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const navigate = useNavigate()
  const canTrash = useCanTrashMaps()
  const { requestTrash, dialog: trashDialog } = useTrashMapConfirm()
  const mediaActionsFor = useMediaActionsFor()
  const pendingMapsOf = useCallback((item) => item.kind === 'map' && item.sistemaId === sistemaId, [sistemaId])
  const byId = new Map(allMaps.map((map) => [map.id, map]))
  // Each system's together (its own first), in its order: the editors',
  // the maps they haven't placed (new ones) first, newest first, the undated
  // last (as every list of maps).
  const sorted = sistemaId
    ? orderSistemaMaps(
        getSistemaMapRefs(sistemaId, sistemas, connections)
          .map(({ id, sistemaId: ownerId }) => byId.get(id) && { ...byId.get(id), sistemaId: ownerId })
          .filter(Boolean),
        sistemas,
      )
    : []
  // Editors reorder them in Show all, each among its own system's.
  const [order, reorder, groupOf] = useMapReorder(sorted, sistemas)
  const sortedById = new Map(sorted.map((map) => [map.id, map]))
  const maps = order.map((id) => sortedById.get(id)).filter(Boolean)
  if (loading || (maps.length === 0 && !sistemaId && !isEditor)) return null
  // A map's menu (editors): edit it; delete it, to the trash (admins).
  const mapActions = (map) => [
    { label: tEdit('editMap'), icon: <EditRounded fontSize="small" />, onClick: () => navigate(`${pagePath}/maps/${map.id}/edit`, { state: { fromPage: true, editFromViewer: true } }) },
    canTrash && { label: tEdit('trashMap'), icon: <DeleteForeverRounded fontSize="small" />, onClick: () => requestTrash(map), danger: true },
  ].filter(Boolean)
  // Its menu: everyone's actions (its address in the page's gallery, its
  // file), then the editors'.
  const mapMenu = (map) => withOthers(
    mediaActionsFor({ kind: 'map', itemId: map.id, shareUrl: `${SITE_URL}${pagePath}/maps/${map.id}`, download: { url: map.url, fileName: downloadName('opencaves-map', map.id, map.contentType) }, reportPage: `${pagePath}/maps/${map.id}` }),
    isEditor ? mapActions(map) : [],
  )
  // A map opens in the page's gallery; named by its name and year.
  const mapLink = (map) => ({ component: RouterLink, to: `${pagePath}/maps/${map.id}`, state: { fromPage: true }, 'aria-label': [map.name, mapYear(map)].filter(Boolean).join(', ') })

  return (
    <IndexSection id="maps" title={title} count={maps.length || undefined} className="oc-maps-section" card={card}>
      {maps.length === 0 && <EmptySectionText>{tMaps('empty.maps', { ns: 'indexPages' })}</EmptySectionText>}
      {maps.length > 0 && (
        // The strip's own padding: none sideways (the card's), its block
        // one; its width, the items' measure (cqi).
        <Box sx={{ containerType: 'inline-size', '--oc-pane-padding-inline': '0px', '--oc-pane-padding-block': '16px' }}>
          <MediaStrip start="start" fill className="oc-maps-section--strip" itemHeight={PAGE_STRIP.height} height={PAGE_STRIP.itemHeight} gap={PAGE_STRIP.gap} rebuildKey={maps.map((map) => map.id).join(' ')}>
            {maps.map((map) => (
              // A tile (the strip draws it from copies of itself, its caption
              // curved with it, its menu left live), one a column.
              <Box key={map.id} className="oc-maps-section--item oc-media-strip--tile oc-media-strip--paper oc-media-strip--item" sx={{ position: 'relative', flexShrink: 0, width: PAGE_STRIP.itemWidth, height: PAGE_STRIP.itemHeight, borderRadius: 2 }}>
                <ButtonBase {...mapLink(map)} className="oc-maps-section--link" sx={{ display: 'block', width: '100%', height: '100%', textAlign: 'left', color: 'inherit', textDecoration: 'none', borderRadius: 2, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
                  <MapThumbnail map={map} />
                </ButtonBase>
                <CardOptionsMenu ariaLabel={tEdit('mapOptions')} actions={mapMenu(map)} />
              </Box>
            ))}
          </MediaStrip>
          <StripShowAll title={title} sortable={isEditor ? { enabled: true, ids: maps.map((map) => map.id), onReorder: reorder, groupOf } : undefined}>
            {maps.map((map) => (
              <li key={map.id}>
                <Box sx={{ position: 'relative' }}>
                  <ButtonBase {...mapLink(map)} className="oc-maps-section--item oc-carousel--media" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', textAlign: 'left', color: 'inherit', textDecoration: 'none' }}>
                    <MapThumbnail map={map} />
                  </ButtonBase>
                  <CardOptionsMenu reveal ariaLabel={tEdit('mapOptions')} actions={mapMenu(map)} />
                </Box>
              </li>
            ))}
          </StripShowAll>
        </Box>
      )}
      <PendingUploadsStrip filter={pendingMapsOf} sx={{ mt: maps.length > 0 ? 2 : 0 }} />
      <AddMapButton sistemaId={sistemaId} canAdd={isEditor} onAddUnauthorized={requireLogin} spaced={maps.length > 0} />
      {trashDialog}
    </IndexSection>
  )
}

// A map's year: maps' dates are "2000", "2012-10" or "1988-02-01".
const mapYear = (map) => map.date?.match(/\d{4}/)?.[0]

/**
 * A map's thumbnail filling its item, its name and year over its
 * bottom: each line on a dark band fitted to its text (inline, cloned on
 * every line), readable over any drawing. Opaque: at line height 1 a wrapped
 * name's bands overlap, which a see-through band would show as a darker
 * stripe.
 *
 * @param {object} props
 * @param {CaveMap} props.map
 */
function MapThumbnail({ map }) {
  const { t } = useTranslation('indexPages')
  const year = mapYear(map)
  const thumbnail = map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : null)
  return (
    <Box className="oc-maps-section--thumbnail" sx={{ position: 'relative', width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
      {thumbnail ? (
        // Picture: a thumbnail not on the device offline says so.
        <Picture src={thumbnail} alt={map.name ? t('mapAlt', { name: map.name }) : ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : map.contentType === 'application/pdf' ? (
        <PictureAsPdfRounded color="primary" fontSize="large" />
      ) : (
        <MapRounded color="primary" fontSize="large" />
      )}
      <Box className="oc-maps-section--caption" sx={{ position: 'absolute', left: { xs: 12, sm: 8 }, right: { xs: 12, sm: 8 }, bottom: { xs: 12, sm: 8 }, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', '& span': { lineHeight: 1, px: '6px', py: '3px', color: 'common.white', bgcolor: 'rgb(32, 32, 32)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } }}>
        <Box sx={{ lineHeight: 1 }}>
          <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.01em', overflowWrap: 'anywhere' }}>
            {map.name}
          </Typography>
        </Box>
        {year && (
          // Smaller than the title, its box as tall as at 12px (22.5px): the
          // smaller text's lost height given back in its padding.
          <Typography component="span" sx={{ fontSize: '0.6875rem', letterSpacing: '0.03em', color: 'rgba(255, 255, 255, 0.8) !important', '&&': { py: '3.625px' } }}>
            {year}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
