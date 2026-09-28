import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import pushId from 'unique-push-id'
import { AddRounded, ArrowBackRounded } from '@mui/icons-material'
import { Alert, Box, Button, Divider, IconButton, ListSubheader, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import ConnectionModel from '@/models/ConnectionModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import PartialDateField, { isValidPartialDate } from '@/components/PartialDateField.jsx'
import NewSourceDialog from '@/components/NewSourceDialog.jsx'
import CreatableTextField from '@/components/CreatableTextField.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

const sourcesModel = createCollectionModel('sources')
const areasModel = createCollectionModel('areas')
// Menu value for the "Add a source" entry; can't collide with a push id.
const ADD_SOURCE = '__add-source__'

function SistemaColor({ color }) {
  return <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: 0.5, bgcolor: color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
}

// Muted secondary label so the area reads as context, not part of the name.
function SistemaArea({ name }) {
  if (!name) return null
  return (
    <Typography component="span" variant="body2" className="oc-connection-edit--area" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
      {name}
    </Typography>
  )
}

export default function ConnectionEdit() {
  const { connectionId } = useParams()
  const isNew = connectionId === 'new'
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const { setTitle } = useTitle()
  const [connections, connectionsLoading, connectionsError] = ConnectionModel.useAll()
  const [sistemas] = SistemaModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [areas] = areasModel.useAll()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [parentSearch, setParentSearch] = useState('')
  const [addingSource, setAddingSource] = useState(false)

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
      const id = isNew ? pushId() : connectionId
      await ConnectionModel.save(id, {
        sistemaId: form.sistemaId,
        parentSistemaId: form.parentSistemaId,
        source: form.source || deleteField(),
        connectionDate: form.connectionDate.trim() || deleteField(),
        reporter: form.reporter.trim() || deleteField(),
        note: form.note.trim() || deleteField(),
      })
      invalidateData()
      await getData()
      // Stays on the form after saving. A new connection only gets its id
      // here, so the URL switches to it (replace, no new history entry) to
      // make a second Save update it instead of creating another one.
      if (isNew) navigate(`/connections/${id}/edit`, { replace: true })
      openSnackbar(tApp('snackbar.saved'))
    } catch (cause) {
      console.error(cause)
      setError(t('connectionSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const childSistema = sistemas.find((sistema) => sistema.id === form?.sistemaId)
  const childName = childSistema?.name || form?.sistemaId || ''
  // Every distinct reporter already used on a connection, for the dropdown.
  const reporterOptions = useMemo(() => [...new Set(connections.map((item) => item.reporter?.trim()).filter(Boolean))].sort((first, second) => first.localeCompare(second)), [connections])
  const areaNames = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas])
  const getAreaName = (sistema) => (sistema?.area ? areaNames.get(sistema.area) || sistema.area : null)
  const parentGroups = useMemo(() => {
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
  }, [areaNames, sistemas, form?.sistemaId, form?.parentSistemaId, parentSearch, t])

  return (
    <div className="oc-connection-edit">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('backToConnections')}>
          <IconButton component={Link} to="/connections" aria-label={t('backToConnections')} sx={{ ml: { xs: 0, sm: -5 } }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5" data-appbar-page-title>
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
            // A read-only select rather than a plain text field, so the value
            // renders exactly like the parent field (color, name, area inline).
            <TextField
              select
              label={t('childSistema')}
              value={form.sistemaId}
              fullWidth
              slotProps={{
                select: {
                  readOnly: true,
                  IconComponent: () => null,
                  renderValue: () => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SistemaColor color={childSistema?.color} />
                      {childName}
                      <SistemaArea name={getAreaName(childSistema)} />
                    </Box>
                  ),
                },
              }}
            >
              <MenuItem value={form.sistemaId}>{childName}</MenuItem>
            </TextField>
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
                      <SistemaArea name={getAreaName(parent)} />
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
          <TextField
            select
            label={t('connectionSource')}
            fullWidth
            value={form.source}
            onChange={(event) => {
              // The "Add a source" entry opens the dialog instead of becoming the value.
              if (event.target.value === ADD_SOURCE) setAddingSource(true)
              else setForm((current) => ({ ...current, source: event.target.value }))
            }}
          >
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
            <Divider />
            <MenuItem value={ADD_SOURCE} sx={{ color: 'primary.main' }}>
              <AddRounded fontSize="small" sx={{ mr: 1 }} />
              {t('addSource')}
            </MenuItem>
          </TextField>
          <NewSourceDialog
            open={addingSource}
            onClose={() => setAddingSource(false)}
            onCreated={(id) => {
              setAddingSource(false)
              setForm((current) => ({ ...current, source: id }))
            }}
          />
          <PartialDateField label={t('connectionDate')} allowRange={false} sx={{ alignSelf: 'flex-start', width: 280 }} {...field('connectionDate')} />
          <CreatableTextField className="oc-connection-edit--reporter" label={t('connectionReporter')} options={reporterOptions} value={form.reporter} onChange={(reporter) => setForm((current) => ({ ...current, reporter }))} />
          <TextField label={t('connectionNote')} fullWidth multiline minRows={2} sx={{ '& textarea': { resize: 'vertical' } }} {...field('note')} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button component={Link} to="/connections" disabled={saving}>
              {t('cancel')}
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !form.sistemaId || !form.parentSistemaId || !isValidPartialDate(form.connectionDate, { allowRange: false })}>
              {t('save')}
            </Button>
          </Box>
        </Box>
      )}
    </div>
  )
}
