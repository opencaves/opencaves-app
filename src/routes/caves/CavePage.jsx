import { useMemo } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Link, Tooltip, Typography } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import { buildSistemaAncestryComputer } from '@/services/data-service/postProcessCaveData.js'
import { useCaveAssetsList, useCoverImage } from '@/models/CaveAsset.js'
import { slugify } from '@/utils/slug.js'
import { markdownToPlainText, truncate } from '@/utils/seo.js'
import { COORDINATE_DECIMALS } from '@/config/map.js'
import Markdown from '@/components/Markdown/Markdown.jsx'
import Picture from '@/components/Picture.jsx'
import Access from '@/components/ResultPane/Access.jsx'
import ExplorationHistory from '@/components/ResultPane/ExplorationHistory.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import MapsSection from '@/components/IndexPage/MapsSection.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { throwNotFound } from '@/components/IndexPage/notFound.js'

const sectionHeadingProps = { component: 'h2', variant: 'h6', sx: { mb: 1.5, pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' } }
// The photos shown here (the map's media pane has them all).
const MAX_PHOTOS = 12

// The cave's photos, its cover first, each opening in the map's media pane.
function CavePhotos({ caveId, title }) {
  const { t } = useTranslation('indexPages')
  const [list] = useCaveAssetsList(caveId)
  const photos = (list?.docs || []).slice(0, MAX_PHOTOS).map((doc) => doc.data())
  if (photos.length === 0) return null
  return (
    <IndexSection title={title} count={list.size} className="oc-cave-page--photos">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5 }}>
        {photos.map((photo, index) => (
          <Box key={photo.id} component={RouterLink} to={`/map/${caveId}/medias/${photo.id}`} aria-label={t('cave.openPhoto', { n: index + 1 })} sx={{ display: 'block', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}>
            <Picture sources={photo.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </Box>
        ))}
      </Box>
    </IndexSection>
  )
}

// The cover photo, under the heading.
function CaveCover({ caveId }) {
  const [cover] = useCoverImage(caveId)
  const sources = useMemo(() => (cover ? cover.data().getSources('coverImage') : null), [cover])
  if (!sources) return null
  return (
    <Box className="oc-cave-page--cover" sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', aspectRatio: '16 / 9', maxHeight: 420, bgcolor: 'action.hover' }}>
      <Picture sources={sources} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </Box>
  )
}

// /caves/<id>: a cave's own page - what the map's details pane shows, as a
// page: its area and system, location, access, description, photos and its
// system's exploration history, and a link to it on the map (/map/<id>).
// Editors edit it at /caves/<id>/edit.
export default function CavePage() {
  const { caveId } = useParams()
  const { t } = useTranslation('indexPages')
  const { t: tPane } = useTranslation('resultPane')
  const { data, loading } = useIndexData()
  const cave = useSelector((state) => state.data.caves.find((c) => c.id === caveId))

  const name = cave?.name?.value?.trim() || ''
  const label = name || t('unnamedCave')
  const summary = cave ? markdownToPlainText(cave.description) : ''
  const description = cave ? truncate(summary ? `${t('cave.descriptionPrefix', { name: label })} ${summary}` : t('cave.description', { name: label })) : null
  useIndexPageHead({ title: cave ? label : null, description })

  // Its system and the systems that one joined, for the history (as the
  // details pane).
  const historySistemas = useMemo(() => {
    if (!cave?.sistemaId) return []
    const ancestry = buildSistemaAncestryComputer(data.sistemas, data.connections)({ sistemaId: cave.sistemaId }) || []
    return ancestry.map(({ id }) => data.sistemasById.get(id)).filter(Boolean)
  }, [cave, data])

  if (loading) return <IndexPageSkeleton />
  if (!cave) throwNotFound()

  const area = cave.area ? data.areasBySlug.get(slugify(cave.area)) || null : null
  const sistema = cave.sistemaId ? data.sistemasById.get(cave.sistemaId) || null : null
  const location = cave.location?.latitude != null ? cave.location : null
  const aka = [...(Array.isArray(cave.aka) ? cave.aka : []), ...Object.values(cave.nameTranslations || {}).flat()].filter(Boolean)
  const facts = [
    area && { key: 'area', label: t('cave.area'), value: <Link component={RouterLink} to={`/areas/${area.slug}`} underline="hover">{area.name}</Link> },
    sistema && { key: 'sistema', label: t('cave.sistema'), value: <><SistemaArrow color={sistema.color} sx={{ mr: 0.75 }} />{sistema.slug ? <Link component={RouterLink} to={`/sistemas/${sistema.slug}`} underline="hover">{sistema.name}</Link> : sistema.name}</> },
    location && { key: 'location', label: t('cave.location'), value: `${Number(location.latitude).toFixed(COORDINATE_DECIMALS)}, ${Number(location.longitude).toFixed(COORDINATE_DECIMALS)}` },
  ].filter(Boolean)
  const hasHistory = historySistemas.some((s) => (s.explorations || []).some((e) => e.date || e.team || e.description))

  return (
    <div className="oc-cave-page">
      <IndexPageHeader
        trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }, { label: t('menu.caves', { ns: 'app' }), to: '/caves' }, ...(area ? [{ label: area.name, to: `/areas/${area.slug}` }] : [])]}
        current={label}
        title={label}
        subtitle={aka.length > 0 ? `${tPane('aka')} ${[...new Set(aka)].join(', ')}` : null}
        backTo="/caves"
        editTo={`/caves/${cave.id}/edit`}
        editLabel={t('cave.edit', { name: label })}
      />

      {/* At the right end, under the heading. */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        {/* Disabled without coordinates, saying why: a disabled button fires no
            events, so the tooltip is on a wrapper. */}
        <Tooltip title={location ? '' : t('notOnMap')}>
          <span>
            <Button className="oc-cave-page--on-map" component={RouterLink} to={`/map/${cave.id}`} disabled={!location} variant="contained" disableElevation startIcon={<MapOutlined />} sx={{ borderRadius: 5 }}>
              {t('onMap')}
            </Button>
          </span>
        </Tooltip>
      </Box>

      <CaveCover caveId={cave.id} />

      {facts.length > 0 && (
        <Box component="dl" className="oc-cave-page--facts" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1, m: 0, mb: 3 }}>
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

      <Box className="oc-cave-page--access" sx={{ mb: 3 }}>
        <Access cave={cave} />
      </Box>

      {cave.description && (
        <Box component="section" className="oc-cave-page--description" sx={{ mb: 4 }}>
          <Markdown>{cave.description}</Markdown>
        </Box>
      )}

      <CavePhotos caveId={cave.id} title={t('cave.photos')} />

      <MapsSection sistemaId={cave.sistemaId} sistemas={data.sistemas} connections={data.connections} caveId={cave.id} title={t('maps')} />

      {hasHistory && (
        <Box component="section" className="oc-cave-page--history" sx={{ mb: 4, '& .oc-exploration-history': { mt: 0, ml: 0 } }}>
          <ExplorationHistory sistemas={historySistemas} headingProps={sectionHeadingProps} showNotes={false} />
        </Box>
      )}
    </div>
  )
}
