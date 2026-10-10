import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Chip, Skeleton, Stack, SvgIcon, Typography } from '@mui/material'
import LinkRounded from '@mui/icons-material/LinkRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import VideoLibraryRounded from '@mui/icons-material/VideoLibraryRounded'
import CaveAsset from '@/models/CaveAsset.js'
import MapRounded from '@mui/icons-material/MapRounded'
import { callable } from '@/config/firebase.js'
import { APP_NAME } from '@/config/app.js'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import CaveIcon from '@/images/map/cave.svg?react'
import { youtubeThumbnail } from '@/utils/videos.js'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'

const getWhatsNew = callable('getWhatsNew')
const KINDS = ['caves', 'sistemas', 'connections', 'maps', 'photos', 'videos']
const CHANGES = ['added', 'modified', 'removed']

// Each change's label chip: M3 container colours from the theme (light and
// dark) - added the secondary container, modified a neutral one, removed the
// error colour's.
const CHANGE_CHIP_SX = {
  added: (theme) => ({ bgcolor: theme.vars.sys.color.secondaryContainer, color: theme.vars.sys.color.onSecondaryContainer }),
  modified: (theme) => ({ bgcolor: theme.vars.palette.action.selected, color: theme.vars.palette.text.primary }),
  removed: (theme) => ({ bgcolor: `rgba(${theme.vars.palette.error.mainChannel} / 0.14)`, color: theme.vars.palette.error.main }),
}

// A stored field's name in words, for one the page has no label for
// (explorationDate: "exploration date").
const readableField = (field) => field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()

// A filter group kept in the address (?kind=caves&kind=maps&change=added):
// its picked values, the known ones only (an empty set shows them all), and
// its setter, which replaces the history entry - a filter isn't a page to go
// back to.
function useFilterParam(name, known) {
  const [params, setParams] = useSearchParams()
  const raw = params.getAll(name).join(' ')
  const picked = useMemo(() => new Set(raw.split(' ').filter((value) => known.includes(value))), [raw, known])
  const setPicked = (values) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete(name)
      // In the group's own order, so one choice has one address.
      for (const value of known) if (values.has(value)) next.append(name, value)
      return next
    }, { replace: true })
  const toggle = (value) => {
    const next = new Set(picked)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setPicked(next)
  }
  return [picked, setPicked, toggle]
}

// What's new, built by the server from the audit log as it is now
// (getWhatsNew): loading until it answers.
function useWhatsNew() {
  const [state, setState] = useState({ items: [], loading: true, failed: false })
  useEffect(() => {
    let active = true
    getWhatsNew()
      .then(({ data }) => active && setState({ items: data.items.map((item, index) => ({ change: 'added', ...item, id: `${item.change}-${item.kind}-${item.docId}-${index}`, at: item.at ? new Date(item.at) : null })), loading: false, failed: false }))
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
          <Skeleton variant="text" sx={{ ...PAGE_TITLE_SX, width: 'min(100%, 260px)' }} />
          <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: 280 }} />
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {[58, 72, 108, 104, 70, 74, 74].map((width, i) => (
            <Skeleton key={i} variant="rounded" sx={{ width, height: 32, borderRadius: 4 }} />
          ))}
        </Stack>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {[112, 80, 96, 92].map((width, i) => (
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

// A change's label: Added, Modified, Removed.
function ChangeChip({ change }) {
  const { t } = useTranslation('whatsNew')
  return <Chip className={`oc-whats-new--change oc-whats-new--change-${change}`} size="small" label={t(`changes.${change}`)} sx={[{ height: 20, fontSize: '0.75rem', fontWeight: 500, '& .MuiChip-label': { px: 1 } }, CHANGE_CHIP_SX[change]]} />
}

/**
 * /whats-new: the caves, cave systems, connections and maps people added,
 * modified or removed in the app (from the audit log, {@link getWhatsNew}),
 * and the photos and videos added to caves (by cave and day), newest first, by
 * day - each marked Added, Modified (with the fields changed) or Removed,
 * linked to its page (a removed one isn't), with who did it. Names come from
 * the app's data when it has the record, the server's otherwise. Two filter
 * groups, by kind and by change, each showing all when none is picked, kept
 * in the address (?kind=caves&kind=maps&change=added).
 */
export default function WhatsNew() {
  const { t, i18n } = useTranslation('whatsNew')
  const { data } = useIndexData()
  const { items, loading, failed } = useWhatsNew()
  // The kinds shown, and the changes (added, modified, removed): none picked
  // shows them all. Both in the address, so a filtered list can be shared.
  const [kinds, setKinds, toggleKind] = useFilterParam('kind', KINDS)
  const [changes, setChanges, toggleChange] = useFilterParam('change', CHANGES)

  useIndexPageHead({ title: t('title'), description: t('description', { name: APP_NAME }) })

  // Each item as the page shows it: its icon, label, link and secondary line.
  const rows = useMemo(() => {
    const sistemaName = (id) => data.sistemasById.get(id)?.name
    // A cave's system beside it, unless named like the cave (a leading
    // "Cenote" aside), as on /caves.
    const bare = (name) => (name || '').toLowerCase().replace(/^cenote\s+/, '').trim()
    const inSistema = (sistema, caveName) => (sistema && bare(sistema.name) !== bare(caveName) ? t('inSistema', { name: sistema.name }) : null)
    const sistemaOfMap = (mapId) => data.sistemas.find((sistema) => Array.isArray(sistema.maps) && sistema.maps.includes(mapId))
    // The changed fields in words: the page's labels, else the stored name.
    const fieldList = (fields) => fields.map((field) => t(`fields.${field}`, { defaultValue: readableField(field) })).join(', ')
    return items.map((item) => {
      const row = describe(item)
      // A removed record has no page any more; a modified one lists its changed fields.
      return { ...row, to: item.change === 'removed' ? null : row.to, changed: item.change === 'modified' && item.fields?.length ? t('changedFields', { fields: fieldList(item.fields) }) : null }
    })

    function describe(item) {
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
        return { ...item, at, icon: photos ? <PhotoLibraryRounded /> : <VideoLibraryRounded />, thumbnails, label: t(photos ? 'photosAdded' : 'videosAdded', { count: item.count, name: cave?.name || item.name || t('unnamedCave') }), to, context: inSistema(sistema, cave?.name || item.name) }
      }
      const sistema = sistemaOfMap(item.docId)
      return { ...item, at, icon: <MapRounded />, label: item.name || t('unnamedMap'), to: sistema?.slug ? `/sistemas/${sistema.slug}/maps/${item.docId}` : null, context: sistema ? t('mapOf', { name: sistema.name }) : null }
    }
  }, [items, data, t])

  // Each filter group's counts follow the other group's choice.
  const kindShown = (row) => kinds.size === 0 || kinds.has(row.kind)
  const changeShown = (row) => changes.size === 0 || changes.has(row.change)
  const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((row) => row.kind === k && changeShown(row)).length]))
  const changeCounts = Object.fromEntries(CHANGES.map((c) => [c, rows.filter((row) => row.change === c && kindShown(row)).length]))
  // The rows shown, by day (newest first).
  const days = useMemo(() => {
    const dayOf = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' })
    const groups = []
    for (const row of rows.filter((r) => (kinds.size === 0 || kinds.has(r.kind)) && (changes.size === 0 || changes.has(r.change)))) {
      // Capitalised: a heading (French and Spanish day names are lowercase).
      const day = row.at ? dayOf.format(row.at) : null
      const label = day ? day.charAt(0).toLocaleUpperCase(i18n.language) + day.slice(1) : t('recently')
      const last = groups[groups.length - 1]
      if (last?.label === label) last.rows.push(row)
      else groups.push({ label, rows: [row] })
    }
    return groups
  }, [rows, kinds, changes, i18n.language, t])

  if (loading) return <WhatsNewSkeleton />

  return (
    <div className="oc-whats-new">
      <IndexPageHeader trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]} current={t('title')} title={t('title')} subtitle={t('subtitle', { name: APP_NAME })} />

      {failed && <Typography color="error">{t('failed')}</Typography>}

      {/* Filters by kind, with their counts. */}
      {/* The two filter groups, a line between them: one group could be
          taken for both. Their names are for screen readers (aria-label). */}
      <Box className="oc-whats-new--filter-groups" sx={{ display: 'grid', rowGap: 1.5, mb: 3 }}>
        <Stack direction="row" role="group" aria-label={t('filters.kindsLabel')} className="oc-whats-new--filters" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {/* Several kinds at once; All shows every kind again. */}
          {['all', ...KINDS].map((k) => {
            const selected = k === 'all' ? kinds.size === 0 : kinds.has(k)
            return (
              <Chip
                key={k}
                label={`${t(`filters.${k}`)} ${k === 'all' ? rows.filter(changeShown).length : counts[k]}`}
                onClick={() => (k === 'all' ? setKinds(new Set()) : toggleKind(k))}
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                disabled={k !== 'all' && counts[k] === 0 && !selected}
                aria-pressed={selected}
              />
            )
          })}
        </Stack>

        <Box aria-hidden sx={{ borderTop: 1, borderColor: 'divider' }} />
        {/* Filters by change (added, modified, removed), apart from the kinds. */}
        <Stack direction="row" role="group" aria-label={t('filters.changesLabel')} className="oc-whats-new--change-filters" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {['allChanges', ...CHANGES].map((c) => {
            const selected = c === 'allChanges' ? changes.size === 0 : changes.has(c)
            return (
              <Chip
                key={c}
                label={`${t(`filters.${c}`)} ${c === 'allChanges' ? rows.filter(kindShown).length : changeCounts[c]}`}
                onClick={() => (c === 'allChanges' ? setChanges(new Set()) : toggleChange(c))}
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                disabled={c !== 'allChanges' && changeCounts[c] === 0 && !selected}
                aria-pressed={selected}
              />
            )
          })}
        </Stack>
      </Box>

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
                    <Box sx={{ width: 56, display: 'flex', justifyContent: 'center', color: row.change === 'removed' ? 'text.disabled' : 'primary.main', flexShrink: 0, '& svg': { fontSize: 28 } }}>{row.icon}</Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25 }}>
                      {/* A removed record: its name muted, without a link. */}
                      <Typography component="div" className="oc-whats-new--label" sx={{ fontWeight: 500, minWidth: 0, color: row.to ? 'var(--mui-sys-color-primary)' : row.change === 'removed' ? 'text.secondary' : 'text.primary' }}>
                        {row.label}
                      </Typography>
                      <ChangeChip change={row.change} />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {[t(`kinds.${row.kind}`), row.context, row.changed, row.authorName && t(`${row.change}By`, { name: row.authorName })].filter(Boolean).join(' · ')}
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
