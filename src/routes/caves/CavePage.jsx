import { useMemo, useState } from 'react'
import { Link as RouterLink, Outlet, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, ButtonBase, Link, Tooltip, Typography } from '@mui/material'
import MapRounded from '@mui/icons-material/MapRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import { EntranceRounded } from '@/components/icons.jsx'
import LocalParkingRounded from '@mui/icons-material/LocalParkingRounded'
import KeyRounded from '@mui/icons-material/KeyRounded'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { useCaveData } from '@/hooks/useCaveData.js'
import { buildSistemaAncestryComputer } from '@/services/data-service/postProcessCaveData.js'
import { useCoverImage } from '@/models/CaveAsset.js'
import mapsModel from '@/models/MapModel.js'
import { slugify } from '@/utils/slug.js'
import { markdownToPlainText, truncate } from '@/utils/seo.js'
import { COORDINATE_DECIMALS } from '@/config/map.js'
import { staticMapUrl } from '@/utils/staticMap.js'
import Markdown from '@/components/Markdown/Markdown.jsx'
import TextSource from '@/components/TextSource.jsx'
import SectionReview from '@/components/CaveReview/SectionReview.jsx'
import AddAPhotoRounded from '@mui/icons-material/AddAPhotoRounded'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import { useAddMedias } from '@/components/AddMedias/useAddMedias.jsx'
import { ACCEPTED_MIME_TYPES } from '@/config/mediaPane.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import CaveReportWarnings from '@/components/CaveReview/CaveReportWarnings.jsx'
import Picture from '@/components/Picture.jsx'
import Access, { AccessReview } from '@/components/ResultPane/Access.jsx'
import ExplorationHistory from '@/components/ResultPane/ExplorationHistory.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection, { CARD_FOOTER_SX } from '@/components/IndexPage/IndexSection.jsx'
import MapsSection from '@/components/IndexPage/MapsSection.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import CavePhotosSection from '@/components/IndexPage/CavePhotosSection.jsx'
import CoordinateCopyList from '@/components/CoordinateCopyList.jsx'
import CaveVideosSection from '@/components/IndexPage/CaveVideosSection.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import NoMatch from '@/routes/NoMatch.jsx'
import OfflineSaveHint from '@/components/Offline/OfflineSaveHint.jsx'
import Dropzone from '@/components/AddMedias/Dropzone.jsx'
import { useWindowFileDrop } from '@/hooks/useWindowFileDrop.jsx'
import { teamNames } from '@/utils/explorationTeam.js'
import PlaceRounded from '@mui/icons-material/PlaceRounded'
import Address from '@/components/ResultPane/Address.jsx'
import { nameTranslationLines } from '@/utils/nameTranslations.js'
import { nearbyCaves } from '@/utils/nearbyCaves.js'
import { useUnits } from '@/hooks/useUnits.jsx'
import { formatDistance } from '@/utils/units.js'
import { sistemaTitle } from '@/utils/sistemaTitle.js'

// The cover photo, under the heading (cover: CavePage's useCoverImage).
// Its box keeps the photo's 16:9 shape while it downloads. The page's
// largest paint: fetched first (fetchPriority), never lazily - and preloaded
// by the page the server rendered (entry-server.jsx's coverPreload). Its alt
// names the cave (search engines report images without one).
function CaveCover({ cover, name }) {
  const { t } = useTranslation('indexPages')
  const sources = useMemo(() => (cover ? cover.data().getSources('coverImage') : null), [cover])
  if (!sources) return null
  return (
    // Its column's full width (an aspect-ratio box isn't stretched in a grid),
    // its height capped: a wide screen's photo is cropped, not narrowed.
    <Box className="oc-cave-page--cover" sx={{ width: '100%', borderRadius: 3, overflow: 'hidden', aspectRatio: '16 / 9', maxHeight: 480, bgcolor: 'action.hover' }}>
      <Picture sources={sources} alt={name ? t('cave.coverAlt', { name }) : ''} fetchPriority="high" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </Box>
  )
}

/**
 * The cover's place when the cave has no photo yet: the same 16:9 panel (the
 * page keeps its shape), saying so - Add photos, the whole panel a click
 * target and a drop target for photos: an editor's opens the photo picker,
 * or takes the files dropped (AddMediasProvider); anyone else is asked to
 * sign in first.
 *
 * @param {object} props
 * @param {string} props.caveId
 * @param {boolean} props.isEditor
 */
function CaveCoverEmpty({ caveId, isEditor }) {
  const requireLogin = useRequireLogin('photos')
  if (!isEditor) return <CoverEmptyPanel onAdd={requireLogin} onFiles={requireLogin} />
  return (
    <AddMediasProvider caveId={caveId}>
      <EditorCoverEmpty />
    </AddMediasProvider>
  )
}

// An editor's: picking or dropping photos adds them to the cave.
function EditorCoverEmpty() {
  const { promptForMedias, addMedias } = useAddMedias()
  return <CoverEmptyPanel onAdd={promptForMedias} onFiles={addMedias} />
}

/**
 * The empty cover panel - one big button, in its own style: its message, an
 * Add photos pill (the button's label, not a button of its own), M3's state
 * layer on hover and press, and a drop target for image files, highlighted
 * while some hover over it.
 *
 * @param {object} props
 * @param {() => void} props.onAdd - A click, Enter or Space.
 * @param {(files: File[]) => void} props.onFiles - Image files dropped on it.
 */
function CoverEmptyPanel({ onAdd, onFiles }) {
  const { t } = useTranslation('indexPages')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [dragOver, setDragOver] = useState(false)
  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files')
  return (
    <ButtonBase
      className="oc-cave-page--cover oc-cave-page--cover-empty"
      data-drag-over={dragOver || undefined}
      onClick={onAdd}
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(/** @type {Node} */ (event.relatedTarget))) setDragOver(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDragOver(false)
        const files = [...event.dataTransfer.files].filter((file) => ACCEPTED_MIME_TYPES.includes(file.type))
        if (files.length) onFiles(files)
      }}
      sx={(theme) => ({
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: 480,
        borderRadius: 3,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        p: 3,
        // A quiet surface, a soft light from above, a fine edge - its edge
        // the primary colour, dashed, while photos are dragged over it.
        background: `radial-gradient(120% 90% at 50% 0%, ${theme.vars.sys.color.surfaceContainerLow}, ${theme.vars.sys.color.surfaceContainerHigh})`,
        border: `1px solid ${theme.vars.sys.color.outlineVariant}`,
        color: theme.vars.palette.text.primary,
        transition: theme.transitions.create(['border-color', 'box-shadow']),
        // M3's state layer: the content colour over it, 8% on hover (and
        // while photos hover over it), 10% pressed; its pill lifted with it.
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          bgcolor: 'currentColor',
          opacity: 0,
          transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest }),
          pointerEvents: 'none',
        },
        '&:hover::before, &[data-drag-over]::before': { opacity: 0.08 },
        '&:active::before': { opacity: 0.1 },
        '&:hover .oc-cave-page--add-photos, &.Mui-focusVisible .oc-cave-page--add-photos': { boxShadow: 2 },
        '&.Mui-focusVisible': { outline: `3px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
        '&[data-drag-over]': { border: `2px dashed ${theme.vars.palette.primary.main}`, boxShadow: 2 },
      })}
    >
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <AddAPhotoRounded aria-hidden="true" sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.disabled' }} />
        <Typography component="span" sx={{ color: 'text.secondary' }}>{t('cave.noPhoto')}</Typography>
        {/* The button's label, styled as a filled tonal pill. */}
        <Box
          component="span"
          className="oc-cave-page--add-photos"
          sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', gap: 1, height: 48, px: 3, borderRadius: 7, ...theme.typography.button, fontSize: '0.9375rem', textTransform: 'none', bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.onSecondaryContainer, transition: theme.transitions.create('box-shadow') })}
        >
          <AddAPhotoRounded aria-hidden="true" fontSize="small" />
          {tEdit('addPictures')}
        </Box>
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>{t('cave.dropPhotos')}</Typography>
      </Box>
    </ButtonBase>
  )
}

/**
 * A small map of the cave's spot, its pin in its system's colour (a still
 * image of the app's map, staticMapUrl), the whole tile a link to the cave
 * on the map (/map/<id>), labelled "Show on the map": a square, beside the
 * cover photo, or in its place without one.
 *
 * @param {object} props
 * @param {Cave} props.cave
 * @param {{latitude: number, longitude: number}} props.location - Its coordinates.
 * @param {string} [props.color] - Its system's colour (hex), else the app's gold.
 * @param {boolean} [props.alone=false] - Without a cover photo: at most 360px wide.
 */
function CaveMapTile({ cave, location, color, alone = false }) {
  const { t } = useTranslation('indexPages')
  return (
    <Box
      component={RouterLink}
      to={`/map/${cave.id}`}
      className="oc-cave-page--map-tile"
      sx={(theme) => ({
        position: 'relative',
        display: 'block',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        // A square at the bottom of its grid cell, level with the photo's
        // bottom edge (beside it: as wide as its column); alone (no photo),
        // at most 360px, centred.
        aspectRatio: '1 / 1',
        width: '100%',
        maxWidth: alone ? 360 : undefined,
        alignSelf: 'end',
        justifySelf: 'center',
        '&:hover .oc-cave-page--map-tile-label, &:focus-visible .oc-cave-page--map-tile-label': { bgcolor: theme.vars.palette.primary.dark },
        '&:focus-visible': { outline: `3px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <Box component="img" src={staticMapUrl(location, { color: color && color !== '#fff' ? color : undefined, width: 240, height: 240 })} alt="" loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {/* The link's name, centred near the bottom: clear of the pin in the
          middle and above Mapbox's logo and attribution. */}
      <Box
        component="span"
        className="oc-cave-page--map-tile-label"
        sx={(theme) => ({ position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, height: 40, borderRadius: 5, bgcolor: theme.vars.palette.primary.main, color: theme.vars.palette.primary.contrastText, ...theme.typography.button, textTransform: 'none', boxShadow: 2, transition: theme.transitions.create('background-color') })}
      >
        <MapRounded fontSize="small" />
        {t('onMap')}
      </Box>
    </Box>
  )
}

/**
 * /caves/<id>: a cave's own page - what the map's details pane shows, as a
 * page: its area and system, location, access, description, photos and its
 * system's exploration history, and a small map of its spot linking to it
 * on the map (/map/<id>) - beside its cover photo. Its open "closed" or "now
 * private" reports lead it (CaveReportWarnings); each section says how old
 * its information is, on its card's foot: Still accurate to confirm it,
 * its arrow for what changed there (SectionReview).
 * Editors edit it at /caves/<id>/edit.
 */
export default function CavePage() {
  const { caveId } = useParams()
  const { t } = useTranslation('indexPages')
  const { t: tPane, i18n } = useTranslation('resultPane')
  const { data, loading } = useIndexData()
  const { languages, caves, nearby: serverNearby } = useCaveData()
  const units = useUnits()
  // Asked for alongside the data, and waited for: drawn once the page knows
  // whether there is one, the cover no longer pushes the page down when it
  // arrives (a 216-444px jump).
  const [cover, coverLoading] = useCoverImage(caveId)
  // Its system's maps (MapsSection), waited for too.
  const [allMaps, mapsLoading] = mapsModel.useAll()
  const cave = useMemo(() => caves.find((c) => c.id === caveId), [caves, caveId])
  // Its nearest caves: the server's, on the page it rendered (it sends the one
  // cave, not every position); else from every cave here.
  const nearby = useMemo(() => serverNearby ?? (cave ? nearbyCaves(cave, caves, (id) => data.sistemasById.get(id)?.name) : []), [serverNearby, cave, caves, data.sistemasById])
  // Editors: photos dragged anywhere over the page go to this cave, as on the map.
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const [dropzoneOpen, closeDropzone] = useWindowFileDrop(isEditor && Boolean(cave))

  const name = cave?.name?.value?.trim() || ''
  // No name: "(Unnamed cave)" - in parentheses, a placeholder, not a name.
  const label = name || t('unnamedCave')
  const summary = cave ? markdownToPlainText(cave.description) : ''
  // The description's sentence names it without the parentheses.
  const description = cave ? truncate(summary ? `${t('cave.descriptionPrefix', { name: name || t('unnamedCavePlain') })} ${summary}` : t('cave.description', { name: name || t('unnamedCavePlain') })) : null
  useIndexPageHead({ title: cave ? label : null, description })

  // Its system and the systems that one joined, for the history (as the
  // details pane).
  const historySistemas = useMemo(() => {
    if (!cave?.sistemaId) return []
    const ancestry = buildSistemaAncestryComputer(data.sistemas, data.connections)({ sistemaId: cave.sistemaId }) || []
    return ancestry.map(({ id }) => data.sistemasById.get(id)).filter(Boolean)
  }, [cave, data])

  if (loading || coverLoading || mapsLoading) return <IndexPageSkeleton item back cover />
  // No such cave: the "not found" page, rendered rather than thrown - a
  // thrown error is logged to the console by React and React Router.
  if (!cave) return <NoMatch inLayout />

  const area = cave.area ? data.areasBySlug.get(slugify(cave.area)) || null : null
  const sistema = cave.sistemaId ? data.sistemasById.get(cave.sistemaId) || null : null
  const location = cave.location?.latitude != null ? cave.location : null
  const aka = (Array.isArray(cave.aka) ? cave.aka : []).filter(Boolean)
  // Its translations apart from aka, each labelled (as the map's pane).
  const nameTranslations = nameTranslationLines(cave, i18n.resolvedLanguage, languages, (language, names) => tPane('nameTranslation', { language, names }))
  const facts = [
    area && { key: 'area', label: t('cave.area'), value: <Link component={RouterLink} to={`/caves#${area.slug}`} underline="hover">{area.name}</Link> },
    sistema && { key: 'sistema', label: t('cave.sistema'), value: <><SistemaArrow color={sistema.color} sx={{ mr: 0.75 }} />{sistema.slug ? <Link component={RouterLink} to={`/sistemas/${sistema.slug}`} underline="hover">{sistema.name}</Link> : sistema.name}</> },
  ].filter(Boolean)
  // Its points, as the map pane lists them: each copied on a click, with
  // directions to it.
  const coordinates = (point) => `${Number(point.latitude).toFixed(COORDINATE_DECIMALS)}, ${Number(point.longitude).toFixed(COORDINATE_DECIMALS)}`
  const isPoint = (point) => point?.latitude != null && point?.longitude != null
  const points = [
    location && { key: 'location', icon: <MyLocationRounded />, text: coordinates(location), copyText: coordinates(location), copyLabel: tPane('copyCoordinates'), point: location, directionsLabel: tPane('directionsToCave') },
    isPoint(cave.parking) && { key: 'parking', icon: <LocalParkingRounded />, text: coordinates(cave.parking), copyText: coordinates(cave.parking), copyLabel: tPane('copyParkingCoordinates'), point: cave.parking, directionsLabel: tPane('directionsToParking') },
    isPoint(cave.entrance) && { key: 'entrance', icon: <EntranceRounded />, text: coordinates(cave.entrance), copyText: coordinates(cave.entrance), copyLabel: tPane('copyEntranceCoordinates'), point: cave.entrance, directionsLabel: tPane('directionsToEntrance') },
    ...(Array.isArray(cave.keys) ? cave.keys.filter(isPoint) : []).map((key, index) => ({ key: `key-${index}`, icon: <KeyRounded />, text: coordinates(key), copyText: coordinates(key), copyLabel: tPane('copyCoordinates'), point: key, directionsLabel: tPane('directionsToKey') })),
  ].filter(Boolean).map((row) => ({ ...row, analytics: { cave_id: cave.id, point: row.key.replace(/-\d+$/, '') } }))
  const hasHistory = historySistemas.some((s) => (s.explorations || []).some((e) => e.date || teamNames(e.team).length || e.description))

  return (
    <div className="oc-cave-page">
      <IndexPageHeader
        sticky
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }, { label: t('menu.caves', { ns: 'app' }), to: '/caves' }]}
        current={label}
        title={label}
        subtitle={[aka.length > 0 && `${tPane('aka')} ${[...new Set(aka)].join(', ')}`, ...nameTranslations].filter(Boolean).join(' · ') || null}
        backTo={area ? `/caves#${area.slug}` : '/caves'}
        editTo={`/caves/${cave.id}/edit`}
        editLabel={t('cave.edit', { name: label })}
      />

      {/* Its open "closed" or "now private" reports, above all else. */}
      <CaveReportWarnings caveId={cave.id} sx={{ mb: 3, '&:empty': { display: 'none' } }} />

      {location ? (
        // The cover photo and a small map of the cave's spot side by side
        // (4:1, with room around the photo: it leads the page; stacked on
        // phones, the photo first); without a photo, the map in its place.
        <Box className="oc-cave-page--top" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '4fr 1fr' }, gap: { xs: 2, sm: 4 }, mb: { xs: 3, sm: 5 } }}>
          {/* No photo yet: the same layout, Add photos in the cover's place. */}
          {cover ? <CaveCover cover={cover} name={name} /> : !coverLoading && <CaveCoverEmpty caveId={cave.id} isEditor={isEditor} />}
          <CaveMapTile cave={cave} location={location} color={sistema?.color} alone={!cover && coverLoading} />
        </Box>
      ) : (
        <>
          {/* Not on the map: the button disabled, saying why (a disabled
              button fires no events, so the tooltip is on a wrapper). */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Tooltip title={t('notOnMap')}>
              <span>
                <Button className="oc-cave-page--on-map" disabled variant="contained" disableElevation startIcon={<MapRounded />} sx={{ borderRadius: 5 }}>
                  {t('onMap')}
                </Button>
              </span>
            </Tooltip>
          </Box>
          {(cover || !coverLoading) && (
            <Box sx={{ mb: 3 }}>
              {cover ? <CaveCover cover={cover} name={name} /> : <CaveCoverEmpty caveId={cave.id} isEditor={isEditor} />}
            </Box>
          )}
        </>
      )}

      {facts.length > 0 && (
        <Box component="dl" className="oc-cave-page--facts" sx={{ ...DASHBOARD_SURFACE_SX, p: { xs: 2, sm: 3 }, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1, m: 0, mb: 3 }}>
          {facts.map(({ key, label: factLabel, value }) => (
            <Box key={key} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" sx={{ color: 'text.secondary', alignSelf: 'baseline' }}>
                {factLabel}
              </Typography>
              <Typography component="dd" sx={{ m: 0, alignSelf: 'baseline' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {points.length > 0 && (
        <IndexSection id="location" title={t('cave.location')} className="oc-cave-page--location" card>
          {/* Its address, as the map's pane shows it (the caveAddress function). */}
          {location && (
            <Typography className="oc-cave-page--address" variant="body2" sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
              <PlaceRounded aria-hidden="true" sx={{ color: 'primary.main', mr: 1 }} />
              <Address caveId={cave.id} longitude={location.longitude} latitude={location.latitude} />
            </Typography>
          )}
          <CoordinateCopyList rows={points} sx={{ mx: -1 }} />
        </IndexSection>
      )}

      {/* Access's own heading is the section's, above its card. */}
      {/* Its Still accurate (access and fees together) on the card's foot. */}
      <IndexSection id="access" title={tPane('accessHeader')} className="oc-cave-page--access" card footer={<AccessReview cave={cave} />}>
        <Box sx={{ '& h2.h2': { display: 'none' }, '& .details-container': { px: 0 } }}>
          <Access cave={cave} review={false} />
        </Box>
      </IndexSection>

      {/* How to get there - the map's pane had it, this page didn't. */}
      {cave.direction && (
        <IndexSection id="getting-there" title={tPane('directionsHeader')} className="oc-cave-page--directions" card footer={<SectionReview cave={cave} sections={['directions']} />}>
          <Markdown>{cave.direction}</Markdown>
          <TextSource record={cave} field="direction" />
        </IndexSection>
      )}

      {cave.description && (
        <Box sx={{ mb: 3 }}>
          <Box component="section" id="description" className="oc-cave-page--description" sx={{ scrollMarginTop: 'calc(64px + var(--oc-page-title-height, 0px) + 8px)', ...DASHBOARD_SURFACE_SX, p: { xs: 2, sm: 3 }, '& > :first-child > :first-child': { mt: 0 }, '& > :last-child > :last-child': { mb: 0 } }}>
            <Markdown>{cave.description}</Markdown>
            <TextSource record={cave} field="description" />
            {/* Its Still accurate on the card's foot, as the other cards'. */}
            <Box className="oc-cave-page--review" sx={CARD_FOOTER_SX}>
              <SectionReview cave={cave} sections={['description']} />
            </Box>
          </Box>
        </Box>
      )}


      {/* Offline, a cave not saved: what's missing, and how to keep it all -
          above the photos, even when their list (never loaded online) can't
          show. */}
      <OfflineSaveHint caveId={cave.id} />
      <CavePhotosSection caveId={cave.id} name={name} title={t('cave.photos')} />
      <CaveVideosSection cave={cave} />

      <MapsSection sistemaId={cave.sistemaId} sistemas={data.sistemas} connections={data.connections} pagePath={`/caves/${cave.id}`} title={t('maps')} card pageMaps={allMaps} />

      {hasHistory && (
        <IndexSection id="history" title={tPane('explorationHistory')} className="oc-cave-page--history" card>
          <Box sx={{ '& .oc-exploration-history': { mt: 0, ml: 0 } }}>
            <ExplorationHistory sistemas={historySistemas} showHeading={false} />
          </Box>
        </IndexSection>
      )}
      {/* The caves nearest it, as links (search engines go from cave to cave). */}
      {nearby.length > 0 && (
        <IndexSection id="nearby" title={t('cave.nearby')} className="oc-cave-page--nearby" card>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', columns: { sm: 2 }, columnGap: 4, '& li': { breakInside: 'avoid', py: 0.5 } }}>
            {nearby.map(({ id, name: nearbyName, distance, sistema }) => (
              <li key={id}>
                <Link component={RouterLink} to={`/caves/${id}`} underline="hover" sx={{ fontWeight: 500 }}>
                  {nearbyName}
                </Link>
                <Typography component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {' · '}
                  {formatDistance(distance, units, i18n.language)}
                  {sistema && sistema !== nearbyName && ` · ${sistemaTitle(sistema, (systemName) => t('sistema.title', { name: systemName }))}`}
                </Typography>
              </li>
            ))}
          </Box>
        </IndexSection>
      )}
      {isEditor && <Dropzone open={dropzoneOpen} onDrop={closeDropzone} caveId={cave.id} />}

      {/* Its galleries, over the page: its photos, its system's maps. */}
      <Outlet context={{ sistemaId: cave.sistemaId, sistemas: data.sistemas, connections: data.connections }} />
    </div>
  )
}
