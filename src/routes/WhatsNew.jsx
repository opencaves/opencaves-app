import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Chip, Skeleton, Stack, SvgIcon, Typography } from '@mui/material'
import LinkRounded from '@mui/icons-material/LinkRounded'
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined'
import VideoLibraryOutlined from '@mui/icons-material/VideoLibraryOutlined'
import CaveAsset from '@/models/CaveAsset.js'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { callable } from '@/config/firebase.js'
import { APP_NAME } from '@/config/app.js'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import CaveIcon from '@/images/map/cave.svg?react'
import { youtubeThumbnail } from '@/utils/videos.js'

const getWhatsNew = callable('getWhatsNew')
const KINDS = ['caves', 'sistemas', 'connections', 'maps', 'photos', 'videos']

// What's new, built by the server from the audit log as it is now
// (getWhatsNew): loading until it answers.
function useWhatsNew() {
  const [state, setState] = useState({ items: [], loading: true, failed: false })
  useEffect(() => {
    let active = true
    getWhatsNew()
      .then(({ data }) => active && setState({ items: data.items.map((item, index) => ({ ...item, id: `${item.kind}-${item.docId}-${index}`, at: item.at ? new Date(item.at) : null })), loading: false, failed: false }))
      .catch((error) => {
        console.error(error)
        if (active) setState({ items: [], loading: false, failed: true })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

// The page while getWhatsNew answers, shaped as it: its header, the filter
// chips, then a day's entries on a card (a thumbnail, a name, a line under it).
function WhatsNewSkeleton() {
  const { t } = useTranslation('app')
  return (
    <Box className="oc-whats-new-skeleton" aria-busy="true">
      <Box component="span" role="status" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {t('loading')}
      </Box>
      <Box aria-hidden="true">
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 140, mb: 3 }} />
          <Skeleton variant="text" sx={{ typography: { xs: 'h5', sm: 'h4' }, width: 'min(100%, 260px)' }} />
          <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 280 }} />
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {[58, 72, 108, 104, 70, 74, 74].map((width, i) => (
            <Skeleton key={i} variant="rounded" sx={{ width, height: 32, borderRadius: 4 }} />
          ))}
        </Stack>
        <Skeleton variant="text" sx={{ fontSize: '1rem', width: 220, mb: 1, ml: 0.5 }} />
        <Box sx={{ ...DASHBOARD_SURFACE_SX, p: 1 }}>
          {[55, 40, 65, 45, 50, 35, 60, 42].map((width, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1 }}>
              <Skeleton variant="rounded" sx={{ width: 56, height: 42, borderRadius: 1, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" sx={{ fontSize: '1rem', width: `${width}%` }} />
                <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: `${Math.round(width * 0.6)}%` }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

// A photo's small thumbnail, from what getWhatsNew sends of it.
const photoThumbnail = (caveId, { id, thumbnailRevision, viewThumbnailRevision }) => {
  const asset = new CaveAsset({ caveId })
  Object.assign(asset, { id, thumbnailRevision, viewThumbnailRevision })
  return asset.getThumbnailUrl('resultThumbnail')
}

// /whats-new: the caves, cave systems, connections and maps people added in
// the app (the audit log's create entries, getWhatsNew), and the photos and
// videos added to caves (by cave and day), newest first, by day - each linked
// to its page, with who added it. Names come from the app's
// data when it has the record, the server's otherwise.
export default function WhatsNew() {
  const { t, i18n } = useTranslation('whatsNew')
  const { data } = useIndexData()
  const { items, loading, failed } = useWhatsNew()
  // The kinds shown: none picked shows them all.
  const [kinds, setKinds] = useState(() => new Set())
  const toggleKind = (k) =>
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  useIndexPageHead({ title: t('title'), description: t('description', { name: APP_NAME }) })

  // Each item as the page shows it: its icon, label, link and secondary line.
  const rows = useMemo(() => {
    const sistemaName = (id) => data.sistemasById.get(id)?.name
    // A cave's system beside it, unless named like the cave (a leading
    // "Cenote" aside), as on /caves.
    const bare = (name) => (name || '').toLowerCase().replace(/^cenote\s+/, '').trim()
    const inSistema = (sistema, caveName) => (sistema && bare(sistema.name) !== bare(caveName) ? t('inSistema', { name: sistema.name }) : null)
    const sistemaOfMap = (mapId) => data.sistemas.find((sistema) => Array.isArray(sistema.maps) && sistema.maps.includes(mapId))
    return items.map((item) => {
      const { at } = item
      if (item.kind === 'caves') {
        const cave = data.caves.find((c) => c.id === item.docId)
        const sistema = data.sistemasById.get(cave?.sistemaId || item.sistemaId)
        return { ...item, at, icon: <SvgIcon inheritViewBox><CaveIcon /></SvgIcon>, label: cave?.name || item.name || t('unnamedCave'), to: cave ? `/caves/${item.docId}` : null, context: inSistema(sistema, cave?.name || item.name) }
      }
      if (item.kind === 'sistemas') {
        const sistema = data.sistemasById.get(item.docId)
        return { ...item, at, icon: <SistemaArrow color={sistema?.color} />, label: sistema?.name || item.name || t('unnamedSistema'), to: sistema?.slug ? `/sistemas/${sistema.slug}` : null, context: null }
      }
      if (item.kind === 'connections') {
        const child = data.sistemasById.get(item.sistemaId)
        return { ...item, at, icon: <LinkRounded />, label: t('connection', { child: sistemaName(item.sistemaId) || t('unnamedSistema'), parent: sistemaName(item.parentSistemaId) || t('unnamedSistema') }), to: child?.slug ? `/sistemas/${child.slug}#connections` : null, context: null }
      }
      if (item.kind === 'photos' || item.kind === 'videos') {
        const cave = data.caves.find((c) => c.id === item.caveId)
        const sistema = data.sistemasById.get(cave?.sistemaId || item.sistemaId)
        const photos = item.kind === 'photos'
        const thumbnails = (item.media || []).map((media) => (photos ? photoThumbnail(item.caveId, media) : youtubeThumbnail(media))).filter(Boolean)
        // One photo opens in the cave page's gallery; several, or videos, the
        // cave page's section (#photos, #videos).
        const to = !cave ? null : photos && item.count === 1 ? `/caves/${item.caveId}/photos/${item.media[0].id}` : `/caves/${item.caveId}#${photos ? 'photos' : 'videos'}`
        return { ...item, at, icon: photos ? <PhotoLibraryOutlined /> : <VideoLibraryOutlined />, thumbnails, label: t(photos ? 'photosAdded' : 'videosAdded', { count: item.count, name: cave?.name || item.name || t('unnamedCave') }), to, context: inSistema(sistema, cave?.name || item.name) }
      }
      const sistema = sistemaOfMap(item.docId)
      return { ...item, at, icon: <MapOutlined />, label: item.name || t('unnamedMap'), to: sistema?.slug ? `/sistemas/${sistema.slug}/maps/${item.docId}` : null, context: sistema ? t('mapOf', { name: sistema.name }) : null }
    })
  }, [items, data, t])

  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, rows.filter((row) => row.kind === k).length])), [rows])
  // The rows shown, by day (newest first).
  const days = useMemo(() => {
    const dayOf = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' })
    const groups = []
    for (const row of rows.filter((r) => kinds.size === 0 || kinds.has(r.kind))) {
      // Capitalised: a heading (French and Spanish day names are lowercase).
      const day = row.at ? dayOf.format(row.at) : null
      const label = day ? day.charAt(0).toLocaleUpperCase(i18n.language) + day.slice(1) : t('recently')
      const last = groups[groups.length - 1]
      if (last?.label === label) last.rows.push(row)
      else groups.push({ label, rows: [row] })
    }
    return groups
  }, [rows, kinds, i18n.language, t])

  if (loading) return <WhatsNewSkeleton />

  return (
    <div className="oc-whats-new">
      <IndexPageHeader trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]} current={t('title')} title={t('title')} subtitle={t('subtitle', { name: APP_NAME })} />

      {failed && <Typography color="error">{t('failed')}</Typography>}

      {/* Filters by kind, with their counts. */}
      <Stack direction="row" className="oc-whats-new--filters" sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {/* Several kinds at once; All shows every kind again. */}
        {['all', ...KINDS].map((k) => {
          const selected = k === 'all' ? kinds.size === 0 : kinds.has(k)
          return (
            <Chip
              key={k}
              label={`${t(`filters.${k}`)} ${k === 'all' ? rows.length : counts[k]}`}
              onClick={() => (k === 'all' ? setKinds(new Set()) : toggleKind(k))}
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              disabled={k !== 'all' && counts[k] === 0 && !selected}
              aria-pressed={selected}
            />
          )
        })}
      </Stack>

      {days.length === 0 && !failed && <Typography sx={{ color: 'text.secondary' }}>{t('none')}</Typography>}

      {days.map(({ label, rows: dayRows }) => (
        <Box key={label} component="section" className="oc-whats-new--day" sx={{ mb: 3 }}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, mb: 1, ml: 0.5 }}>
            {label}
          </Typography>
          <Box component="ul" sx={{ ...DASHBOARD_SURFACE_SX, listStyle: 'none', m: 0, p: 1 }}>
            {/* Each entry opens what it is about: the cave's or the system's
                page, a connection's joining system, a map in its system's
                viewer. */}
            {dayRows.map((row) => (
              <Box component="li" key={row.id} className="oc-whats-new--item">
                <Box
                  {...(row.to ? { component: RouterLink, to: row.to } : {})}
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1, borderRadius: 2, color: 'inherit', textDecoration: 'none', ...(row.to && { '&:hover, &:focus-visible': { bgcolor: 'action.hover' }, '&:hover .oc-whats-new--label': { textDecoration: 'underline' } }) }}
                >
                  {row.thumbnailUrl ? (
                    <Box component="img" src={row.thumbnailUrl} alt="" loading="lazy" sx={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 1, flexShrink: 0, bgcolor: 'action.hover' }} />
                  ) : row.thumbnails?.length ? (
                    // Photos and videos: the first few, side by side.
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, minWidth: 56 }}>
                      {row.thumbnails.map((src) => (
                        <Box key={src} component="img" src={src} alt="" loading="lazy" sx={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover' }} />
                      ))}
                    </Box>
                  ) : (
                    <Box sx={{ width: 56, display: 'flex', justifyContent: 'center', color: 'primary.main', flexShrink: 0, '& svg': { fontSize: 28 } }}>{row.icon}</Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="div" className="oc-whats-new--label" sx={{ fontWeight: 500, color: row.to ? 'var(--mui-sys-color-primary)' : 'text.primary' }}>
                      {row.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {[t(`kinds.${row.kind}`), row.context, row.authorName && t('addedBy', { name: row.authorName })].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </div>
  )
}
