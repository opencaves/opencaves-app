import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import { Box, Chip, Stack, SvgIcon, Typography } from '@mui/material'
import LinkRounded from '@mui/icons-material/LinkRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { functions } from '@/config/firebase.js'
import { APP_NAME } from '@/config/app.js'
import { useIndexData } from '@/hooks/useIndexData.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexPageSkeleton from '@/components/IndexPage/IndexPageSkeleton.jsx'
import { useIndexPageHead } from '@/components/IndexPage/useIndexPageHead.js'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import CaveIcon from '@/images/map/cave.svg?react'

const getWhatsNew = httpsCallable(functions, 'getWhatsNew')
const KINDS = ['caves', 'sistemas', 'connections', 'maps']

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

// /whats-new: the caves, cave systems, connections and maps people added in
// the app (the audit log's create entries, getWhatsNew), newest first, by day
// - each linked to its page, with who added it. Names come from the app's
// data when it has the record, the server's otherwise.
export default function WhatsNew() {
  const { t, i18n } = useTranslation('whatsNew')
  const { data } = useIndexData()
  const { items, loading, failed } = useWhatsNew()
  const [kind, setKind] = useState('all')

  useIndexPageHead({ title: t('title'), description: t('description', { name: APP_NAME }) })

  // Each item as the page shows it: its icon, label, link and secondary line.
  const rows = useMemo(() => {
    const sistemaName = (id) => data.sistemasById.get(id)?.name
    const sistemaOfMap = (mapId) => data.sistemas.find((sistema) => Array.isArray(sistema.maps) && sistema.maps.includes(mapId))
    return items.map((item) => {
      const { at } = item
      if (item.kind === 'caves') {
        const cave = data.caves.find((c) => c.id === item.docId)
        const sistema = data.sistemasById.get(cave?.sistemaId || item.sistemaId)
        return { ...item, at, icon: <SvgIcon inheritViewBox><CaveIcon /></SvgIcon>, label: cave?.name || item.name || t('unnamed'), to: cave ? `/caves/${item.docId}` : null, context: sistema ? t('inSistema', { name: sistema.name }) : null }
      }
      if (item.kind === 'sistemas') {
        const sistema = data.sistemasById.get(item.docId)
        return { ...item, at, icon: <SistemaArrow color={sistema?.color} />, label: sistema?.name || item.name || t('unnamed'), to: sistema?.slug ? `/sistemas/${sistema.slug}` : null, context: null }
      }
      if (item.kind === 'connections') {
        const child = data.sistemasById.get(item.sistemaId)
        return { ...item, at, icon: <LinkRounded />, label: t('connection', { child: sistemaName(item.sistemaId) || t('unnamed'), parent: sistemaName(item.parentSistemaId) || t('unnamed') }), to: child?.slug ? `/sistemas/${child.slug}` : null, context: null }
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
    for (const row of rows.filter((r) => kind === 'all' || r.kind === kind)) {
      const label = row.at ? dayOf.format(row.at) : t('recently')
      const last = groups[groups.length - 1]
      if (last?.label === label) last.rows.push(row)
      else groups.push({ label, rows: [row] })
    }
    return groups
  }, [rows, kind, i18n.language, t])

  if (loading) return <IndexPageSkeleton card />

  return (
    <div className="oc-whats-new">
      <IndexPageHeader trail={[{ label: t('menu.home', { ns: 'app' }), to: '/' }]} current={t('title')} title={t('title')} subtitle={t('subtitle', { name: APP_NAME })} />

      {failed && <Typography color="error">{t('failed')}</Typography>}

      {/* Filters by kind, with their counts. */}
      <Stack direction="row" className="oc-whats-new--filters" sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {['all', ...KINDS].map((k) => (
          <Chip
            key={k}
            label={`${t(`filters.${k}`)} ${k === 'all' ? rows.length : counts[k]}`}
            onClick={() => setKind(k)}
            color={kind === k ? 'primary' : 'default'}
            variant={kind === k ? 'filled' : 'outlined'}
            disabled={k !== 'all' && counts[k] === 0}
            aria-pressed={kind === k}
          />
        ))}
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
