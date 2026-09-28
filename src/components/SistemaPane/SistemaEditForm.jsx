import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Divider, Grid, IconButton, ListSubheader, MenuItem, TextField, Typography } from '@mui/material'
import { AddRounded, ArrowBackRounded, CloseRounded } from '@mui/icons-material'
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
import PartialDateField, { isValidPartialDate } from '@/components/PartialDateField.jsx'
import CreatableTextField from '@/components/CreatableTextField.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')

const emptyExploration = { date: '', team: '', description: '', notes: '' }

function parseLocalizedNumber(value, locale) {
  if (value === '' || value === null || typeof value === 'undefined') return null

  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const groupSeparator = parts.find((part) => part.type === 'group')?.value
  const decimalSeparator = parts.find((part) => part.type === 'decimal')?.value || '.'
  let normalized = String(value).trim()

  if (groupSeparator) normalized = normalized.split(groupSeparator).join('')
  normalized = normalized.replace(/[\s\u00a0\u202f]/g, '')
  if (decimalSeparator !== '.') normalized = normalized.replace(decimalSeparator, '.')

  const number = Number(normalized)
  return normalized && Number.isFinite(number) ? number : null
}

function formatLocalizedNumber(value, locale) {
  const number = parseLocalizedNumber(value, locale)
  return number === null ? String(value ?? '') : new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(number)
}

function ExplorationsField({ label, addLabel, removeLabel, dateLabel, teamLabel, teamOptions, descriptionLabel, notesLabel, values, onChange }) {
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
              <Grid size={12}>
                <CreatableTextField size="small" label={teamLabel} options={teamOptions} value={exploration.team} onChange={(team) => updateAt(index, { team })} />
              </Grid>
              <Grid size={12}>
                <PartialDateField size="small" label={dateLabel} fullWidth value={exploration.date} onChange={(e) => updateAt(index, { date: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <MarkdownField label={descriptionLabel} value={exploration.description} onChange={(e) => updateAt(index, { description: e.target.value })} minRows={3} resizable />
              </Grid>
              <Grid size={12}>
                <TextField size="small" label={notesLabel} fullWidth multiline minRows={2} value={exploration.notes} onChange={(e) => updateAt(index, { notes: e.target.value })} sx={{ '& textarea': { resize: 'vertical' } }} />
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
// surrounding chrome. onDone is called after cancel/delete so each
// caller can decide where that goes (a hard navigate for the standalone
// page, a slide-out-then-back for the pane).
export default function SistemaEditForm({ sistemaId, onTitleChange, onDone }) {
  const { t, i18n } = useTranslation('sistemaEditForm')
  const locale = i18n.resolvedLanguage || i18n.language || 'en'
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const [sistemas, sistemasLoading] = SistemaModel.useAll()
  const [connections, connectionsLoading] = ConnectionModel.useAll()
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
  const [focusedNumberField, setFocusedNumberField] = useState(null)
  const [parentSearch, setParentSearch] = useState('')
  const parentSearchInputRef = useRef(null)

  useEffect(() => {
    if (sistemasLoading || connectionsLoading) {
      return
    }

    const sistema = sistemas.find((item) => item.id === sistemaId)
    const connection = connections.find((item) => item.sistemaId === sistemaId)

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
  }, [connections, connectionsLoading, sistemaId, sistemas, sistemasLoading])

  useEffect(() => {
    onTitleChange?.(isNew ? t('newSistema') : t('sistemaTitle', { name: form.name || sistemaId }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  async function handleSave() {
    const length = form.length === '' ? null : parseLocalizedNumber(form.length, locale)
    const maxDepth = form.maxDepth === '' ? null : parseLocalizedNumber(form.maxDepth, locale)
    if ((form.length !== '' && length === null) || (form.maxDepth !== '' && maxDepth === null)) return

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
        length: form.length === '' ? undefined : length,
        maxDepth: form.maxDepth === '' ? undefined : maxDepth,
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
      // Stays on the form after saving; only cancel/delete leave it.
      setIsNew(false)
      openSnackbar(tApp('snackbar.saved'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) {
      return
    }
    await SistemaModel.remove(sistemaId)
    invalidateData()
    await getData()
    onDone()
  }

  if (loading) {
    return <Typography className="oc-sistema-edit-form">{t('loading')}</Typography>
  }

  const areasById = new Map(areas.map((a) => [a.id, a.name]))
  const otherSistemas = sistemas.filter((s) => s.id !== sistemaId)
  const teamOptions = [...new Set([...sistemas.flatMap((sistema) => (sistema.explorations || []).map((exploration) => exploration.team?.trim()).filter(Boolean)), ...form.explorations.map((exploration) => exploration.team?.trim()).filter(Boolean)])].sort((first, second) => first.localeCompare(second))
  const parentSearchQuery = parentSearch.trim().toLowerCase()
  const visibleParentSistemas = parentSearchQuery ? otherSistemas.filter((s) => (s.name || s.id).toLowerCase().includes(parentSearchQuery) || (areasById.get(s.area) || '').toLowerCase().includes(parentSearchQuery)) : otherSistemas
  const hasInvalidExplorationDate = form.explorations.some((e) => !isValidPartialDate(e.date))
  const hasInvalidMeasurement = ['length', 'maxDepth'].some((name) => form[name] !== '' && parseLocalizedNumber(form[name], locale) === null)

  return (
    <Box className="oc-sistema-edit-form">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={onDone} aria-label={t('backToSistemas')} sx={{ ml: -5 }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5">
          {t('sistemaTitle', { name: form.name || sistemaId })}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField label={t('name')} fullWidth required {...field('name')} />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label={t('parentSistema')}
            fullWidth
            {...field('parentSistemaId')}
            slotProps={{
              select: {
                // A fixed width keeps the menu from resizing horizontally as
                // the filtered list changes. The search itself is only
                // cleared once the close transition has fully finished
                // (onExited, not onClose) - clearing it any earlier would
                // repopulate the full list while the menu is still visibly
                // fading out.
                MenuProps: {
                  autoFocus: false,
                  slotProps: {
                    paper: { sx: { width: 320 } },
                    transition: { onExited: () => setParentSearch('') },
                  },
                },
              },
            }}
          >
            <ListSubheader
              sx={{ px: 1.5, py: 0.5 }}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') e.stopPropagation()
              }}
            >
              <TextField inputRef={parentSearchInputRef} autoFocus size="small" fullWidth placeholder={t('parentSistemaSearchPlaceholder')} value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
            </ListSubheader>
            <MenuItem value="">{t('none')}</MenuItem>
            {visibleParentSistemas.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name || s.id}
                {areasById.get(s.area) && (
                  <Typography component="span" sx={{ ml: 0.5, color: 'text.disabled' }}>
                    ({areasById.get(s.area)})
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label={t('area')} fullWidth {...field('area')}>
            <MenuItem value="">{t('none')}</MenuItem>
            {areas.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size="auto">
          <ColorPicker label={t('color')} value={form.color} onChange={(hex) => setForm((f) => ({ ...f, color: hex }))} fullWidth={false} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label={t('source')} fullWidth {...field('source')}>
            <MenuItem value="">{t('none')}</MenuItem>
            {sources.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <CoordinateField field="sistemaLocation" label={t('location')} longitude={form.longitude} latitude={form.latitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude }))} />
        </Grid>

        <Grid size={7}>
          <TextField label={t('length')} type="text" inputMode="decimal" fullWidth value={focusedNumberField === 'length' ? form.length : formatLocalizedNumber(form.length, locale)} onFocus={() => setFocusedNumberField('length')} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))} onBlur={() => setFocusedNumberField(null)} error={form.length !== '' && parseLocalizedNumber(form.length, locale) === null} sx={{ '& input': { textAlign: 'right' } }} />
        </Grid>
        <Grid size={5}>
          <TextField label={t('maxDepth')} type="text" inputMode="decimal" fullWidth value={focusedNumberField === 'maxDepth' ? form.maxDepth : formatLocalizedNumber(form.maxDepth, locale)} onFocus={() => setFocusedNumberField('maxDepth')} onChange={(event) => setForm((current) => ({ ...current, maxDepth: event.target.value }))} onBlur={() => setFocusedNumberField(null)} error={form.maxDepth !== '' && parseLocalizedNumber(form.maxDepth, locale) === null} sx={{ '& input': { textAlign: 'right' } }} />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} minRows={5} resizable />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} minRows={5} resizable />
        </Grid>

        <Grid size={12}>
          <ExplorationsField label={t('explorations')} addLabel={t('addExploration')} removeLabel={t('removeExploration')} dateLabel={t('explorationDate')} teamLabel={t('explorationTeam')} teamOptions={teamOptions} descriptionLabel={t('explorationDescription')} notesLabel={t('explorationNotes')} values={form.explorations} onChange={(explorations) => setForm((f) => ({ ...f, explorations }))} />
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        <Grid size={12}>
          <MapsPicker label={t('maps')} value={form.maps} onChange={(maps) => setForm((f) => ({ ...f, maps }))} sistemaName={form.name || sistemaId} />
        </Grid>
      </Grid>

      <Box sx={(theme) => ({ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mt: 3, py: 1.5, position: 'sticky', bottom: 0, zIndex: theme.zIndex.appBar, bgcolor: 'rgba(255, 255, 255, 0.94)', borderTop: '1px solid', borderColor: 'divider' })}>
        {!isNew && (
          <Button color="error" onClick={handleDelete} disabled={saving} sx={{ mr: 'auto' }}>
            {t('delete')}
          </Button>
        )}
        <Button onClick={onDone} disabled={saving} sx={{ minWidth: 88 }}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || hasInvalidExplorationDate || hasInvalidMeasurement} sx={{ minWidth: 88 }}>
          {t('save')}
        </Button>
      </Box>
    </Box>
  )
}
