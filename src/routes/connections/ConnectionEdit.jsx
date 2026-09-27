import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import pushId from 'unique-push-id'
import { ArrowBackRounded } from '@mui/icons-material'
import { Alert, Box, Button, IconButton, InputAdornment, ListSubheader, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import ConnectionModel from '@/models/ConnectionModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'

const sourcesModel = createCollectionModel('sources')
const areasModel = createCollectionModel('areas')

function SistemaColor({ color }) {
  return <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: 0.5, bgcolor: color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
}

export default function ConnectionEdit() {
  const { connectionId } = useParams()
  const isNew = connectionId === 'new'
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { setTitle } = useTitle()
  const [connections, connectionsLoading, connectionsError] = ConnectionModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [areas] = areasModel.useAll()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [parentSearch, setParentSearch] = useState('')

  const connection = connections.find((item) => item.id === connectionId)

  useEffect(() => {
    if (isNew) {
      setForm({ sistemaId: '', parentSistemaId: '', source: '', connectionDate: '', reporter: '', note: '' })
      setError(null)
      return undefined
    }

    if (connectionsLoading) return undefined
    if (connectionsError) {
      console.error(connectionsError)
      setError(t('connectionLoadError'))
      return undefined
    }

    setForm(
      connection
        ? {
            sistemaId: connection.sistemaId,
            parentSistemaId: connection.parentSistemaId || '',
            source: connection.source || '',
            connectionDate: connection.connectionDate || '',
            reporter: connection.reporter || '',
            note: connection.note || '',
          }
        : null,
    )
    setError(connection ? null : t('connectionNotFound'))
    return undefined
  }, [connection, connectionId, connectionsError, connectionsLoading, isNew, t])

  useEffect(() => {
    setTitle(t(isNew ? 'newSistemaConnection' : 'editSistemaConnection'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, t])

  function field(name) {
    return {
      value: form[name],
      onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await ConnectionModel.save(isNew ? pushId() : connectionId, {
        sistemaId: form.sistemaId,
        parentSistemaId: form.parentSistemaId,
        source: form.source || deleteField(),
        connectionDate: form.connectionDate.trim() || deleteField(),
        reporter: form.reporter.trim() || deleteField(),
        note: form.note.trim() || deleteField(),
      })
      invalidateData()
      await getData()
      navigate('/connections')
    } catch (cause) {
      console.error(cause)
      setError(t('connectionSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const childSistema = sistemas.find((sistema) => sistema.id === form?.sistemaId)
  const childName = childSistema?.name || form?.sistemaId || ''
  const parentGroups = useMemo(() => {
    const areaNames = new Map(areas.map((area) => [area.id, area.name]))
    const groups = new Map()
    const term = parentSearch.trim().toLowerCase()
    sistemas
      .filter((sistema) => {
        if (sistema.id === form?.sistemaId) return false
        const areaName = areaNames.get(sistema.area) || sistema.area || t('noSistemaArea')
        return sistema.id === form?.parentSistemaId || !term || (sistema.name || '').toLowerCase().includes(term) || sistema.id.toLowerCase().includes(term) || areaName.toLowerCase().includes(term)
      })
      .forEach((sistema) => {
        const areaName = areaNames.get(sistema.area) || sistema.area || null
        if (!groups.has(areaName)) groups.set(areaName, [])
        groups.get(areaName).push(sistema)
      })
    return [...groups.entries()].sort(([first], [second]) => (first === null ? 1 : second === null ? -1 : first.localeCompare(second))).map(([areaName, group]) => [areaName, group.sort((first, second) => (first.name || first.id).localeCompare(second.name || second.id))])
  }, [areas, sistemas, form?.sistemaId, form?.parentSistemaId, parentSearch, t])

  return (
    <div className="oc-connection-edit">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToConnections')}>
          <IconButton component={Link} to="/connections" aria-label={t('backToConnections')} sx={{ ml: -5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('editSistemaConnection')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!form && !error && <Typography>{t('loading')}</Typography>}

      {form && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 720 }}>
          {isNew ? (
            <TextField select label={t('childSistema')} fullWidth {...field('sistemaId')}>
              <MenuItem value="">{t('childSistema')}</MenuItem>
              {sistemas
                .slice()
                .sort((first, second) => (first.name || first.id).localeCompare(second.name || second.id))
                .map((sistema) => (
                  <MenuItem key={sistema.id} value={sistema.id}>
                    <Box sx={{ mr: 1, display: 'inline-flex' }}>
                      <SistemaColor color={sistema.color} />
                    </Box>
                    {sistema.name || sistema.id}
                  </MenuItem>
                ))}
            </TextField>
          ) : (
            <TextField
              label={t('childSistema')}
              value={childName}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SistemaColor color={childSistema?.color} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
          <TextField
            select
            label={t('parentSistema')}
            fullWidth
            {...field('parentSistemaId')}
            slotProps={{
              select: {
                MenuProps: {
                  autoFocus: false,
                  slotProps: { transition: { onExited: () => setParentSearch('') } },
                },
                renderValue: (value) => {
                  if (!value) return t('noParentSistema')
                  const parent = sistemas.find((sistema) => sistema.id === value)
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SistemaColor color={parent?.color} />
                      {parent?.name || value}
                    </Box>
                  )
                },
              },
            }}
          >
            <ListSubheader
              sx={{ px: 1.5, py: 0.5 }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation()
              }}
            >
              <TextField autoFocus size="small" fullWidth placeholder={t('searchParentSistema')} value={parentSearch} onChange={(event) => setParentSearch(event.target.value)} onClick={(event) => event.stopPropagation()} />
            </ListSubheader>
            <MenuItem value="">{t('noParentSistema')}</MenuItem>
            {form.parentSistemaId && !sistemas.some((sistema) => sistema.id === form.parentSistemaId) && (
              <MenuItem value={form.parentSistemaId} sx={{ display: 'none' }}>
                {form.parentSistemaId}
              </MenuItem>
            )}
            {parentGroups.flatMap(([areaName, group]) => [
              <ListSubheader key={`area-${areaName ?? 'unassigned'}`} sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>
                {areaName ?? t('noSistemaArea')}
              </ListSubheader>,
              ...group.map((sistema) => (
                <MenuItem key={sistema.id} value={sistema.id}>
                  <Box sx={{ mr: 1, display: 'inline-flex' }}>
                    <SistemaColor color={sistema.color} />
                  </Box>
                  {sistema.name || sistema.id}
                </MenuItem>
              )),
            ])}
          </TextField>
          <TextField select label={t('connectionSource')} fullWidth {...field('source')}>
            <MenuItem value="">{t('noSource')}</MenuItem>
            {form.source && !sources.some((source) => source.id === form.source) && (
              <MenuItem value={form.source} sx={{ display: 'none' }}>
                {form.source}
              </MenuItem>
            )}
            {sources.map((source) => (
              <MenuItem key={source.id} value={source.id}>
                {source.name || source.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('connectionDate')} fullWidth {...field('connectionDate')} />
          <TextField label={t('connectionReporter')} fullWidth {...field('reporter')} />
          <TextField label={t('connectionNote')} fullWidth multiline minRows={2} sx={{ '& textarea': { resize: 'vertical' } }} {...field('note')} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button component={Link} to="/connections" disabled={saving}>
              {t('cancel')}
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !form.sistemaId || !form.parentSistemaId}>
              {t('save')}
            </Button>
          </Box>
        </Box>
      )}
    </div>
  )
}
