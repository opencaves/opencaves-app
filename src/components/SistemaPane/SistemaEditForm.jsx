import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import { AddRounded, CloseRounded } from '@mui/icons-material'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { num } from '@/services/data-service/types.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import CoordinateField from '@/components/ResultPane/CoordinateField.jsx'
import ColorPicker from '@/components/ColorPicker/ColorPicker.jsx'
import MapsPicker from '@/components/MapsPicker/MapsPicker.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')

const emptyExploration = { date: '', team: '', description: '', notes: '' }

// Exploration dates only need to be as precise as what's actually known -
// a year, a year and month, or a full day - so this is a plain text field
// rather than a date picker (which forces day-level precision and can't
// represent "2019" or "2019-06" on their own).
const PARTIAL_DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/

function ExplorationsField({ label, addLabel, removeLabel, dateLabel, datePlaceholder, dateInvalidHint, teamLabel, descriptionLabel, notesLabel, values, onChange }) {
  function updateAt(index, patch) {
    onChange(values.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function removeAt(index) {
    onChange(values.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...values, { ...emptyExploration }])
  }

  return (
    <Box className="oc-explorations-field">
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {values.map((exploration, index) => (
          <Box key={index} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, position: 'relative' }}>
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel} sx={{ position: 'absolute', top: 4, right: 4 }}>
              <CloseRounded fontSize="small" />
            </IconButton>
            <Grid container spacing={1.5} sx={{ pr: 4 }}>
              <Grid size={6}>
                <TextField
                  size="small"
                  label={dateLabel}
                  placeholder={datePlaceholder}
                  fullWidth
                  value={exploration.date}
                  onChange={(e) => updateAt(index, { date: e.target.value })}
                  error={!!exploration.date && !PARTIAL_DATE_PATTERN.test(exploration.date)}
                  helperText={exploration.date && !PARTIAL_DATE_PATTERN.test(exploration.date) ? dateInvalidHint : undefined}
                />
              </Grid>
              <Grid size={6}>
                <TextField size="small" label={teamLabel} fullWidth value={exploration.team} onChange={(e) => updateAt(index, { team: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <MarkdownField label={descriptionLabel} value={exploration.description} onChange={(e) => updateAt(index, { description: e.target.value })} minRows={3} resizable />
              </Grid>
              <Grid size={12}>
                <TextField size="small" label={notesLabel} fullWidth multiline minRows={2} value={exploration.notes} onChange={(e) => updateAt(index, { notes: e.target.value })} />
              </Grid>
            </Grid>
          </Box>
        ))}
        <Button size="small" startIcon={<AddRounded />} onClick={add} sx={{ alignSelf: 'flex-start' }}>
          {addLabel}
        </Button>
      </Box>
    </Box>
  )
}

const emptyForm = {
  name: '',
  color: '',
  area: '',
  description: '',
  direction: '',
  length: '',
  maxDepth: '',
  source: '',
  explorations: [],
  aka: [],
  maps: [],
  longitude: '',
  latitude: '',
  parentSistemaId: '',
}

// Shared by the standalone /sistemas/:sistemaId/edit page (SistemaEdit.jsx)
// and the in-pane SistemaEditPane.jsx, so the two only differ in their
// surrounding chrome. onDone is called after save/cancel/delete so each
// caller can decide where that goes (a hard navigate for the standalone
// page, a slide-out-then-back for the pane).
export default function SistemaEditForm({ sistemaId, onTitleChange, onDone }) {
  const { t } = useTranslation('sistemaEditForm')
  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()

  function normalizeCoordinateValue(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return ''
    }

    const normalized = Number(num(value, 5))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [sistema, connection] = await Promise.all([SistemaModel.getById(sistemaId), ConnectionModel.getBySistemaId(sistemaId)])

      if (cancelled) {
        return
      }

      setIsNew(!sistema)
      setForm({
        name: sistema?.name || '',
        color: sistema?.color || '',
        area: sistema?.area || '',
        description: sistema?.description || '',
        direction: sistema?.direction || '',
        length: sistema?.length ?? '',
        maxDepth: sistema?.maxDepth ?? '',
        source: sistema?.source || '',
        explorations: (sistema?.explorations || []).map((e) => ({ ...emptyExploration, ...e })),
        aka: sistema?.aka || [],
        maps: sistema?.maps || [],
        longitude: normalizeCoordinateValue(sistema?.location?.longitude ?? ''),
        latitude: normalizeCoordinateValue(sistema?.location?.latitude ?? ''),
        parentSistemaId: connection?.parentSistemaId || '',
      })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [sistemaId])

  useEffect(() => {
    onTitleChange?.(isNew ? 'New sistema' : form.name || sistemaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const trimmedAka = form.aka.map((s) => s.trim()).filter(Boolean)
      const trimmedExplorations = form.explorations.filter((e) => e.date || e.team || e.description || e.notes)

      const fields = {
        name: form.name,
        color: form.color || undefined,
        area: form.area || undefined,
        description: form.description || undefined,
        direction: form.direction || undefined,
        length: form.length === '' ? undefined : Number(form.length),
        maxDepth: form.maxDepth === '' ? undefined : Number(form.maxDepth),
        source: form.source || undefined,
        explorations: trimmedExplorations.length > 0 ? trimmedExplorations : undefined,
        aka: trimmedAka.length > 0 ? trimmedAka : undefined,
        maps: form.maps.length > 0 ? form.maps : undefined,
        public: true,
      }

      if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, 5)), latitude: Number(num(form.latitude, 5)) }
      }

      await SistemaModel.save(sistemaId, fields)
      await ConnectionModel.setParent(sistemaId, form.parentSistemaId || null)

      invalidateData()
      await getData()
      onDone()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this sistema?')) {
      return
    }
    await SistemaModel.remove(sistemaId)
    invalidateData()
    await getData()
    onDone()
  }

  if (loading) {
    return <Typography className="oc-sistema-edit-form">Loading…</Typography>
  }

  const otherSistemas = sistemas.filter((s) => s.id !== sistemaId)
  const hasInvalidExplorationDate = form.explorations.some((e) => e.date && !PARTIAL_DATE_PATTERN.test(e.date))

  return (
    <Box className="oc-sistema-edit-form">
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        {isNew ? 'New sistema' : form.name || sistemaId}
      </Typography>

      <Grid container spacing={2} sx={{ maxWidth: 720 }}>
        <Grid size={12}>
          <TextField label="Name" fullWidth required {...field('name')} />
        </Grid>

        <Grid size={6}>
          <TextField select label="Parent sistema" fullWidth {...field('parentSistemaId')}>
            <MenuItem value="">(none)</MenuItem>
            {otherSistemas.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name || s.id}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField select label="Area" fullWidth {...field('area')}>
            <MenuItem value="">(none)</MenuItem>
            {areas.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={6}>
          <ColorPicker label="Color" value={form.color} onChange={(hex) => setForm((f) => ({ ...f, color: hex }))} />
        </Grid>
        <Grid size={6}>
          <TextField select label="Source" fullWidth {...field('source')}>
            <MenuItem value="">(none)</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={12}>
          <CoordinateField field="sistemaLocation" label="Location" longitude={form.longitude} latitude={form.latitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude }))} />
        </Grid>

        <Grid size={6}>
          <TextField label={t('length')} type="number" fullWidth {...field('length')} />
        </Grid>
        <Grid size={6}>
          <TextField label="Max depth (m)" type="number" fullWidth {...field('maxDepth')} />
        </Grid>

        <Grid size={12}>
          <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />
        </Grid>

        <Grid size={12}>
          <MarkdownField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} minRows={5} resizable />
        </Grid>

        <Grid size={12}>
          <MarkdownField label="Getting there" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} minRows={3} resizable />
        </Grid>

        <Grid size={12}>
          <ExplorationsField
            label={t('explorations')}
            addLabel={t('addExploration')}
            removeLabel={t('removeExploration')}
            dateLabel={t('explorationDate')}
            datePlaceholder={t('explorationDatePlaceholder')}
            dateInvalidHint={t('explorationDateInvalid')}
            teamLabel={t('explorationTeam')}
            descriptionLabel={t('explorationDescription')}
            notesLabel={t('explorationNotes')}
            values={form.explorations}
            onChange={(explorations) => setForm((f) => ({ ...f, explorations }))}
          />
        </Grid>

        <Grid size={12}>
          <MapsPicker label="Maps" value={form.maps} onChange={(maps) => setForm((f) => ({ ...f, maps }))} />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mt: 3 }}>
        {!isNew && (
          <Button color="error" onClick={handleDelete} disabled={saving} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onDone} disabled={saving} sx={{ minWidth: 88 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || hasInvalidExplorationDate} sx={{ minWidth: 88 }}>
          Save
        </Button>
      </Box>
    </Box>
  )
}
