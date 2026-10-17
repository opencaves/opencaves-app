import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Alert, Box, Button, Chip, CircularProgress, Link as MuiLink, Stack, Tab, Tabs, Typography } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import ImageRounded from '@mui/icons-material/ImageRounded'
import LayersRounded from '@mui/icons-material/LayersRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import { auth, db } from '@/config/firebase.js'
import { TASKS_COLLECTION } from '@/config/collections.js'
import { MAP_TASK_DUPLICATE_SCENARIOS, MAP_TASK_SCENARIOS } from '@/config/tasks.js'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import mapsModel from '@/models/MapModel.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'
import { useTasks } from './useTasks.js'

// The open tasks: the most urgent scenario first (MAP_TASK_SCENARIOS), then
// the newest.
const scenarioRank = (task) => {
  const rank = MAP_TASK_SCENARIOS.indexOf(task.scenario)
  return rank === -1 ? MAP_TASK_SCENARIOS.length : rank
}
const millis = (value) => value?.toMillis?.() ?? 0

/**
 * One map task: the map's thumbnail, name (its file), systems, who added it
 * and when, what the checks found in plain words - its identical or
 * look-alike maps first, as a warning, each a link - and its actions: Done
 * and Dismiss while open, Open again once closed (with who closed it, and why
 * when the server did).
 *
 * @param {object} props
 * @param {MapTask} props.task
 * @param {Map<string, CaveMap>} props.maps - Every map (the trash's too), by id.
 * @param {(mapId: string) => {id: string, name: string}[]} props.systemsOf - The systems listing a map.
 * @param {(uid: string) => string} props.accountLabel - An account's name (useAccounts).
 * @param {(task: MapTask, status: 'open'|'done'|'dismissed') => void} props.onStatus
 * @param {boolean} props.saving
 */
function MapTaskCard({ task, maps, systemsOf, accountLabel, onStatus, saving }) {
  const { t, i18n } = useTranslation('tasks')
  const map = maps.get(task.mapId)
  const name = map?.name || t('untitled')
  const thumbnail = map && (map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : null))
  // A map opens in the survey maps' viewer on its system's page (a raw file
  // may download instead of opening); its file only when no system lists it.
  const viewerOf = (id, record) => {
    const sistema = systemsOf(id)[0]
    return sistema ? `/sistemas/${sistema.id}/maps/${id}` : record && (record.previewUrl || record.url)
  }
  const fileUrl = viewerOf(task.mapId, map)
  const date = (value) => (value?.toDate ? value.toDate().toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : '')
  const systems = systemsOf(task.mapId)
  const exact = task.exactDuplicates || []
  const duplicates = task.duplicates || []
  const open = task.status === 'open'
  const warning = open && MAP_TASK_DUPLICATE_SCENARIOS.includes(task.scenario)
  const systemLinks = (list) =>
    list.map((sistema, index) => (
      <span key={sistema.id}>
        {index > 0 && ', '}
        <MuiLink component={Link} to={`/sistemas/${sistema.id}#maps`}>
          {sistema.name}
        </MuiLink>
      </span>
    ))

  return (
    <Box
      component="li"
      className={`oc-tasks--task oc-tasks--task-${task.scenario}`}
      sx={(theme) => ({ display: 'flex', gap: 2, p: 2, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 }, ...(warning && { borderLeft: `4px solid ${theme.vars.palette.warning.main}` }) })}
    >
      <Box className="oc-tasks--thumbnail" sx={{ flex: 'none', width: { xs: 72, sm: 140 }, height: { xs: 72, sm: 105 }, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <ImageRounded />}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
            {fileUrl ? (
              <MuiLink href={fileUrl} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                {name}
              </MuiLink>
            ) : (
              name
            )}
          </Typography>
          <Chip size="small" color={warning ? 'warning' : 'default'} label={t(`scenarios.${task.scenario}.label`)} />
          {!open && <Chip size="small" variant="outlined" label={t(`status.${task.status}`)} />}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {systems.length ? systemLinks(systems) : t('noSystem')}
          {' · '}
          {t('added', { name: task.addedBy ? accountLabel(task.addedBy) : t('script'), date: date(task.createdAt) })}
          {map?.date && ` · ${t('mapDate', { date: map.date })}`}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {t(`scenarios.${task.scenario}.text`)}
          {task.scenario !== task.layerStatus && task.layerStatus && ` ${t(`scenarios.${task.layerStatus}.text`)}`}
        </Typography>
        {task.tracedMaps?.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {t('traced', { maps: task.tracedMaps.map((traced) => [traced.title, traced.date && `(${traced.date})`].filter(Boolean).join(' ')).join(', ') })}
          </Typography>
        )}
        {duplicates.length > 0 && (
          <Alert className="oc-tasks--duplicates" severity={open ? 'warning' : 'info'} icon={<WarningAmberRounded fontSize="inherit" />} sx={{ mt: 1 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {duplicates.map((id) => {
                const duplicate = maps.get(id)
                const href = duplicate && viewerOf(id, duplicate)
                const label = duplicate?.name || id
                return (
                  <li key={id}>
                    {t(exact.includes(id) ? 'identicalTo' : 'looksLike')}{' '}
                    {href ? (
                      <MuiLink href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                      </MuiLink>
                    ) : (
                      label
                    )}
                    {duplicate?.deletedAt && ` (${t('inTrash')})`}
                    {systemsOf(id).length > 0 && <> · {systemLinks(systemsOf(id))}</>}
                  </li>
                )
              })}
            </Box>
          </Alert>
        )}
        {!open && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {task.closedBy === 'system' ? t(`closedBySystem.${task.closedReason || 'other'}`, { date: date(task.closedAt) }) : t('closedBy', { name: accountLabel(task.closedBy), date: date(task.closedAt) })}
          </Typography>
        )}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
          {open ? (
            <>
              <Button className="oc-tasks--done" size="small" variant="contained" disableElevation startIcon={<CheckRounded />} disabled={saving} onClick={() => onStatus(task, 'done')}>
                {t('done')}
              </Button>
              <Button className="oc-tasks--dismiss" size="small" variant="outlined" startIcon={<CloseRounded />} disabled={saving} onClick={() => onStatus(task, 'dismissed')}>
                {t('dismiss')}
              </Button>
            </>
          ) : (
            <Button className="oc-tasks--reopen" size="small" startIcon={<UndoRounded />} disabled={saving} onClick={() => onStatus(task, 'open')}>
              {t('reopen')}
            </Button>
          )}
          <Button className="oc-tasks--to-process" size="small" component={Link} to="/map-layers?tab=toProcess" startIcon={<LayersRounded />}>
            {t('toProcess')}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

/**
 * /tasks (admins): the to-do list the server keeps in _tasks - today, each
 * survey map added in the app, with what OpenCaves already has of it (an
 * identical file, a look-alike, its system in the cave layer). Open tasks
 * first (?tab=closed: the closed ones), the most urgent on top, live. An
 * admin marks one done or dismisses it, or opens a closed one again; the
 * server closes those whose map went to the trash, was marked not for the
 * layer or entered it.
 */
export default function Tasks() {
  const { t } = useTranslation(['tasks', 'dashboard'])
  const { setTitle } = useTitle()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'closed' ? 'closed' : 'open'
  const { tasks, loading, failed } = useTasks()
  const { accountLabel } = useAccounts()
  const [allMaps] = mapsModel.useAll({ includeTrashed: true })
  const sistemas = useSelector((/** @type {RootState} */ state) => state.data.sistemas)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const maps = useMemo(() => new Map(allMaps.map((map) => [map.id, /** @type {CaveMap} */ (map)])), [allMaps])
  const systemsByMap = useMemo(() => {
    const byMap = new Map()
    ;(sistemas || []).forEach((sistema) => (sistema.maps || []).forEach((mapId) => byMap.set(mapId, [...(byMap.get(mapId) || []), { id: sistema.id, name: sistema.name?.value || sistema.name || sistema.id }])))
    return byMap
  }, [sistemas])
  const systemsOf = (mapId) => systemsByMap.get(mapId) || []

  const open = useMemo(() => tasks.filter((task) => task.status === 'open').sort((a, b) => scenarioRank(a) - scenarioRank(b) || millis(b.createdAt) - millis(a.createdAt)), [tasks])
  const closed = useMemo(() => tasks.filter((task) => task.status !== 'open').sort((a, b) => millis(b.closedAt) - millis(a.closedAt)), [tasks])
  const shown = tab === 'open' ? open : closed

  async function setStatus(task, status) {
    setSaving(true)
    setSaveFailed(false)
    try {
      const fields = status === 'open' ? { status, closedAt: deleteField(), closedBy: deleteField(), closedReason: deleteField() } : { status, closedAt: serverTimestamp(), closedBy: auth.currentUser?.uid ?? null, closedReason: deleteField() }
      await updateDoc(doc(db, TASKS_COLLECTION, task.id), fields)
    } catch (error) {
      console.error(error)
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="oc-tasks" sx={{ minHeight: '100%', minWidth: 0 }}>
      <IndexPageHeader sticky title={t('title')} subtitle={t('intro')} backTo="/dashboard" />

      <Tabs className="oc-tasks--tabs" value={tab} onChange={(_, value) => setSearchParams(value === 'closed' ? { tab: 'closed' } : {}, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="open" label={t('openTab', { count: open.length })} />
        <Tab value="closed" label={t('closedTab')} />
      </Tabs>

      {(failed || saveFailed) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={saveFailed ? () => setSaveFailed(false) : undefined}>
          {t(failed ? 'failed' : 'saveFailed')}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('loading')} />
        </Box>
      ) : shown.length === 0 ? (
        !failed && <Typography sx={{ py: 3, color: 'text.secondary' }}>{t(tab === 'open' ? 'noneOpen' : 'noneClosed')}</Typography>
      ) : (
        <Box component="ul" className="oc-tasks--list" sx={{ ...DASHBOARD_SURFACE_SX, overflow: 'hidden', listStyle: 'none', p: 0, m: 0 }}>
          {shown.map((task) => (
            <MapTaskCard key={task.id} task={task} maps={maps} systemsOf={systemsOf} accountLabel={accountLabel} onStatus={setStatus} saving={saving} />
          ))}
        </Box>
      )}
    </Box>
  )
}
