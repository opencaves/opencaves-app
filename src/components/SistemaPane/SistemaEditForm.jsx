import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import { orDelete } from '@/utils/firestoreFields.js'
import { useSelector } from 'react-redux'
import { Box, Button, Grid, IconButton, ListSubheader, MenuItem, TextField, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import SistemaModel from '@/models/SistemaModel.js'
import ConnectionModel from '@/models/ConnectionModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { num } from '@/services/data-service/types.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import CoordinateFieldList from '@/components/ResultPane/CoordinateFieldList.jsx'
import { coordinateInRange } from '@/components/ResultPane/CoordinateField.jsx'
import CoordinatesMapPreview from '@/components/CoordinatesMapPreview.jsx'
import ColorPicker from '@/components/ColorPicker/ColorPicker.jsx'
import MapsPicker from '@/components/MapsPicker/MapsPicker.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'
import PartialDateField, { isValidPartialDate } from '@/components/PartialDateField.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import StickyActionBar from '@/components/StickyActionBar.jsx'
import AddButton from '@/components/AddButton.jsx'
import { useUnits } from '@/hooks/useUnits.jsx'
import { fromMetres, lengthUnit, toMetres } from '@/utils/units.js'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.jsx'
import { formSectionHeadingProps } from '@/components/formSectionHeading.js'
import FormSection from '@/components/FormSection.jsx'
import EditPageHeader from '@/components/EditPageHeader.jsx'
import SourceSelect from '@/components/SourceSelect.jsx'
import { COORDINATE_DECIMALS } from '@/config/map.js'
import FormSkeleton from '@/components/Skeletons/FormSkeleton.jsx'
import { matchesId } from '@/utils/matchesId.js'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { SISTEMA_TEXT_FIELDS, textSourcesOf, textSourcesUpdate, withTextChange } from '@/utils/textSources.js'
import TextSourceField from '@/components/TextSourceField.jsx'
import CreatableChipsField from '@/components/CreatableChipsField.jsx'
import { teamNames } from '@/utils/explorationTeam.js'

const colorsModel = createCollectionModel('colors')
// One of the colours list's hex values, at random ('' with none).
const randomListColor = (colors) => {
  const hexes = (colors || []).map((c) => c.hex).filter(Boolean)
  return hexes.length ? hexes[Math.floor(Math.random() * hexes.length)] : ''
}

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')

// team: its names, one chip each (a list; older records hold one string).
const emptyExploration = { date: '', team: [], description: '', notes: '' }
const sectionHeadingProps = formSectionHeadingProps('oc-sistema-edit-form--section-title')

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

// The longest system and the deepest cave a form takes, in metres: beyond,
// a typo (99999 for a depth). Below 0 neither makes sense.
const MAX_METRES = { length: 1000000, maxDepth: 1000 }

function formatLocalizedNumber(value, locale) {
  const number = parseLocalizedNumber(value, locale)
  return number === null ? String(value ?? '') : new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(number)
}

function ExplorationsField({ label, addLabel, removeLabel, dateLabel, dateHint, teamLabel, teamOptions, descriptionLabel, notesLabel, values, onChange, labelProps = {} }) {
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
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }} {...labelProps}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {values.map((exploration, index) => (
          <Box key={index} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, position: 'relative' }}>
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel} sx={{ position: 'absolute', top: 4, right: 4 }}>
              <CloseRounded />
            </IconButton>
            <Grid container spacing={1.5} sx={{ pr: 4 }}>
              <Grid size={12}>
                <CreatableChipsField size="small" label={teamLabel} options={teamOptions} value={exploration.team} onChange={(team) => updateAt(index, { team })} />
              </Grid>
              <Grid size={12}>
                <PartialDateField size="small" label={dateLabel} description={dateHint} value={exploration.date} onChange={(e) => updateAt(index, { date: e.target.value })} />
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
        <AddButton onClick={add}>{addLabel}</AddButton>
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
// page, a slide-out-then-back for the pane). onDirtyChange reports whether
// there are unsaved changes (the pane then skips its slide-out, so leaving
// can be confirmed first). showMapPreview adds a map beside the location
// fields, for the standalone page (the pane already has the map behind it).
// onDeleted: where a delete goes instead of onDone, when that differs (the
// standalone page's onDone goes to the system's own page).
// The form's sections, for its loading skeleton (also SistemaEdit's, while
// it finds the system): the main fields, location, aka, description and
// direction.
export const SISTEMA_FORM_SKELETON_SECTIONS = [
  { title: false, fields: ['100%', 'min(100%, 240px)', { width: '100%', helper: true }, 'calc(50% - 8px)', 'calc(50% - 8px)', 'min(100%, 240px)', 'min(100%, 240px)'] },
  { title: true, fields: ['min(100%, 340px)'] },
  { title: true, fields: [{ kind: 'button' }] },
  { title: true, fields: [{ kind: 'markdown', height: 140 }] },
  { title: true, fields: [{ kind: 'markdown', height: 140 }] },
]

/**
 * @param {object} props
 * @param {string} [props.backLabel] - The back arrow's label, where it leads (the systems by default).
 */
export default function SistemaEditForm({ sistemaId, onTitleChange, onDone, onDeleted, onDirtyChange, showMapPreview = false, backLabel }) {
  const isAdmin = useSelector((state) => state.session.roles).includes('admin')
  const { t, i18n } = useTranslation('sistemaEditForm')
  const [colors, colorsLoading] = colorsModel.useAll()
  // Length and depth are stored in metres, shown and entered in the person's units.
  const units = useUnits()
  const shown = (metres) => (metres === '' || metres == null ? '' : Math.round(fromMetres(Number(metres), units) * 10) / 10)
  const isSmall = useSmall()
  const locale = i18n.resolvedLanguage || i18n.language || 'en'
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const [sistemas, sistemasLoading] = SistemaModel.useAll()
  const [connections, connectionsLoading] = ConnectionModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()

  function normalizeCoordinateValue(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return ''
    }

    const normalized = Number(num(value, COORDINATE_DECIMALS))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [focusedNumberField, setFocusedNumberField] = useState(null)
  // Emptied by the person: "Name is required" (not on a new, untouched form).
  const [nameTouched, setNameTouched] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const parentSearchInputRef = useRef(null)

  const hasInvalidExplorationDate = form.explorations.some((e) => !isValidPartialDate(e.date))
  // A number, from 0 to its maximum (in the person's units); the error to show, or null.
  function measurementError(name) {
    if (form[name] === '') return null
    const value = parseLocalizedNumber(form[name], locale)
    if (value === null) return t('measurementInvalid')
    const max = Math.round(fromMetres(MAX_METRES[name], units))
    return value < 0 || value > max ? t('measurementRange', { max: new Intl.NumberFormat(locale).format(max), unit: lengthUnit(units) }) : null
  }
  const hasInvalidMeasurement = ['length', 'maxDepth'].some((name) => measurementError(name))
  const nameMissing = !form.name.trim()
  const canSave = !nameMissing && !hasInvalidExplorationDate && !hasInvalidMeasurement && coordinateInRange(form.longitude, form.latitude)
  const { isDirty, setBaseline, discardChanges, unsavedChangesDialog } = useUnsavedChanges(form, { onSave: handleSave, canSave })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (sistemasLoading || connectionsLoading || colorsLoading) {
      return
    }

    const sistema = sistemas.find((item) => item.id === sistemaId)
    const connection = connections.find((item) => item.sistemaId === sistemaId)

    setIsNew(!sistema)
    const loaded = {
      name: sistema?.name || '',
      // A new system starts with a colour from the list, at random (shown,
      // and changeable, before it's saved).
      color: sistema ? sistema.color || '' : randomListColor(colors),
      area: sistema?.area || '',
      description: sistema?.description || '',
      direction: sistema?.direction || '',
      textSources: textSourcesOf(sistema, SISTEMA_TEXT_FIELDS),
      length: shown(sistema?.length ?? ''),
      maxDepth: shown(sistema?.maxDepth ?? ''),
      source: sistema?.source || '',
      explorations: (sistema?.explorations || []).map((e) => ({ ...emptyExploration, ...e, team: teamNames(e.team) })),
      aka: sistema?.aka || [],
      maps: sistema?.maps || [],
      longitude: normalizeCoordinateValue(sistema?.location?.longitude ?? ''),
      latitude: normalizeCoordinateValue(sistema?.location?.latitude ?? ''),
      parentSistemaId: connection?.parentSistemaId || '',
    }
    setForm(loaded)
    setBaseline(loaded)
    setLoading(false)
    // colorsLoading, not colors: a change to the colours list mustn't reload the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, connectionsLoading, colorsLoading, sistemaId, sistemas, sistemasLoading, setBaseline])

  useEffect(() => {
    // Every edit page's title says so ("Edit …"); a new one stays "New …".
    onTitleChange?.(isNew ? t('newSistema') : tApp('editTitle', { title: t('sistemaTitle', { name: form.name || sistemaId }) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name, t, tApp])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  // The record being edited (null for a new one): what the save compares with.
  const sistema = sistemas.find((item) => item.id === sistemaId) || null

  async function handleSave() {
    const length = form.length === '' ? null : parseLocalizedNumber(form.length, locale)
    const maxDepth = form.maxDepth === '' ? null : parseLocalizedNumber(form.maxDepth, locale)
    if ((form.length !== '' && length === null) || (form.maxDepth !== '' && maxDepth === null)) return

    // No colour chosen: one at random from the colours list, so its pins and
    // arrows aren't left without one (they showed white, with a white glyph).
    const color = form.color || randomListColor(colors)
    const savedForm = color === form.color ? form : { ...form, color }
    if (savedForm !== form) setForm(savedForm)
    setSaving(true)
    try {
      const trimmedAka = form.aka.map((s) => s.trim()).filter(Boolean)
      const trimmedExplorations = form.explorations.filter((e) => e.date || e.team.length || e.description || e.notes).map(({ team, ...e }) => (team.length ? { ...e, team } : e))

      const fields = {
        // The texts' sources the form changed (textSources).
        textSources: textSourcesUpdate(sistema, form, SISTEMA_TEXT_FIELDS),
        name: form.name,
        color: orDelete(color),
        area: orDelete(form.area),
        description: orDelete(form.description),
        direction: orDelete(form.direction),
        // Back to metres; a value left as shown keeps its stored metres exactly.
        length: form.length === '' ? orDelete() : length === shown(sistema?.length ?? '') ? sistema.length : Math.round(toMetres(length, units) * 10) / 10,
        maxDepth: form.maxDepth === '' ? orDelete() : maxDepth === shown(sistema?.maxDepth ?? '') ? sistema.maxDepth : Math.round(toMetres(maxDepth, units) * 10) / 10,
        source: orDelete(form.source),
        explorations: orDelete(trimmedExplorations),
        aka: orDelete(trimmedAka),
        maps: orDelete(form.maps),
        public: true,
      }

      // Emptied coordinates are removed.
      if (form.longitude === '' && form.latitude === '' && sistema?.location) {
        fields.location = deleteField()
      } else if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, COORDINATE_DECIMALS)), latitude: Number(num(form.latitude, COORDINATE_DECIMALS)) }
      }

      // Offline, kept on the device and synced later (useSettleWrite says so).
      const status = await settleWrite([SistemaModel.save(sistemaId, fields), ConnectionModel.setParent(sistemaId, form.parentSistemaId || null)], { name: t('sistemaTitle', { name: form.name || sistemaId }) })
      setBaseline(savedForm)
      // Stays on the form after saving; only cancel/delete leave it.
      setIsNew(false)
      const refresh = async () => {
        invalidateData()
        await getData()
      }
      if (status === 'saved') {
        await refresh()
        openSnackbar(tApp('snackbar.saved', { name: t('sistemaTitle', { name: form.name || sistemaId }) }), { severity: 'success' })
      } else refresh().catch((error) => console.warn(error))
    } catch (error) {
      // Nothing saved: say so, and leave the form as it is (still changed).
      console.error(error)
      openSnackbar(tApp('snackbar.saveError', { name: t('sistemaTitle', { name: form.name || sistemaId }) }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) {
      return
    }
    await SistemaModel.remove(sistemaId)
    discardChanges()
    onDirtyChange?.(false)
    invalidateData()
    await getData()
    const leave = onDeleted || onDone
    leave()
  }

  if (loading) {
    return <FormSkeleton className="oc-sistema-edit-form" sections={SISTEMA_FORM_SKELETON_SECTIONS} />
  }

  const areasById = new Map(areas.map((a) => [a.id, a.name]))
  const otherSistemas = sistemas.filter((s) => s.id !== sistemaId)
  const teamOptions = [...new Set([...sistemas.flatMap((sistema) => (sistema.explorations || []).flatMap((exploration) => teamNames(exploration.team))), ...form.explorations.flatMap((exploration) => teamNames(exploration.team))])].sort((first, second) => first.localeCompare(second))
  const parentSearchQuery = parentSearch.trim().toLowerCase()
  const visibleParentSistemas = parentSearchQuery ? otherSistemas.filter((s) => (s.name || s.id).toLowerCase().includes(parentSearchQuery) || (areasById.get(s.area) || '').toLowerCase().includes(parentSearchQuery) || matchesId(s.id, parentSearchQuery)) : otherSistemas
  const colorPicker = <ColorPicker label={t('color')} value={form.color} onChange={(hex) => setForm((f) => ({ ...f, color: hex }))} fullWidth={false} />
  const colorField = isSmall ? (
    <Grid size="auto">{colorPicker}</Grid>
  ) : (
    <Grid size={12}>
      <Box sx={{ width: 240 }}>{colorPicker}</Box>
    </Grid>
  )

  return (
    <Box className="oc-sistema-edit-form">
      <EditPageHeader>
        <IconButton onClick={onDone} aria-label={backLabel || t('backToSistemas')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5" data-appbar-page-title>
          {t('sistemaTitle', { name: form.name || sistemas.find((item) => item.id === sistemaId)?.name || sistemaId })}
        </Typography>
      </EditPageHeader>

      {/* Each section on its own opaque card (FormSection), on the dashboard's
          translucent page. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormSection>
          <Grid container spacing={2}>
        <Grid size={12}>
          <TextField label={t('name')} fullWidth required {...field('name')} onBlur={() => setNameTouched(true)} error={nameTouched && nameMissing} helperText={nameTouched && nameMissing ? tApp('nameRequired') : undefined} />
        </Grid>
        {/* Wider screens: Color on its own line after Name, then Parent
            sistema on its own, then Area and Source side by side. Phones keep
            Name, Parent sistema, Area, Color, Source. */}
        {!isSmall && colorField}

        <Grid size={12}>
          <TextField
            select
            label={t('parentSistema')}
            helperText={t('parentSistemaHint')}
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

        {isSmall && colorField}
        <Grid size={{ xs: 12, sm: 6 }}>
          {/* The area dropdown's size (beside it): aligned. */}
          <SourceSelect size="medium" label={t('source')} helperText={t('sourceHint')} noneLabel={t('none')} sources={sources} value={form.source} onChange={(source) => setForm((f) => ({ ...f, source }))} />
        </Grid>

        {/* Wider screens: just wide enough for their labels. */}
        <Grid size={{ xs: 7, sm: 'auto' }} sx={{ width: { sm: 240 } }}>
          <TextField label={t('length', { unit: lengthUnit(units) })} type="text" inputMode="decimal" fullWidth value={focusedNumberField === 'length' ? form.length : formatLocalizedNumber(form.length, locale)} onFocus={() => setFocusedNumberField('length')} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))} onBlur={() => setFocusedNumberField(null)} error={!!measurementError('length')} helperText={measurementError('length')} sx={{ '& input': { textAlign: 'right' } }} />
        </Grid>
        <Grid size={{ xs: 5, sm: 'auto' }} sx={{ width: { sm: 160 } }}>
          <TextField label={t('maxDepth', { unit: lengthUnit(units) })} type="text" inputMode="decimal" fullWidth value={focusedNumberField === 'maxDepth' ? form.maxDepth : formatLocalizedNumber(form.maxDepth, locale)} onFocus={() => setFocusedNumberField('maxDepth')} onChange={(event) => setForm((current) => ({ ...current, maxDepth: event.target.value }))} onBlur={() => setFocusedNumberField(null)} error={!!measurementError('maxDepth')} helperText={measurementError('maxDepth')} sx={{ '& input': { textAlign: 'right' } }} />
        </Grid>

          </Grid>
        </FormSection>
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          {/* Same layout as the cave edit page: fields, then the map beside
              them (below on narrower screens). */}
          <Grid container spacing={2} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
            {/* Above the map preview: the fields' own grid overflows a few px
                into it, which otherwise covered part of their buttons. */}
            <Grid size={showMapPreview ? { xs: 12, md: 'auto' } : 12} sx={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
              {/* Empty: behind Add coordinates. */}
              <CoordinateFieldList fieldProps={{ labelProps: sectionHeadingProps, canPickOnMap: showMapPreview }} items={[{ field: 'sistemaLocation', label: t('location'), longitude: form.longitude, latitude: form.latitude, onChange: ({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude })) }]} />
            </Grid>
            {showMapPreview && (
              <Grid size={{ xs: 12, md: 'grow' }}>
                <CoordinatesMapPreview />
              </Grid>
            )}
          </Grid>
        </Grid>

          </Grid>
        </FormSection>
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} labelProps={sectionHeadingProps} />
        </Grid>

          </Grid>
        </FormSection>
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => withTextChange(f, sistema, 'description', e.target.value))} minRows={5} resizable labelProps={sectionHeadingProps} />
          {form.description?.trim() && <TextSourceField value={form.textSources?.description} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, description: value } }))} sources={sources} />}
        </Grid>

          </Grid>
        </FormSection>
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => withTextChange(f, sistema, 'direction', e.target.value))} minRows={5} resizable labelProps={sectionHeadingProps} />
          {form.direction?.trim() && <TextSourceField value={form.textSources?.direction} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, direction: value } }))} sources={sources} />}
        </Grid>

          </Grid>
        </FormSection>
        {/* Its own card: a card shows its first heading only (FormSection),
            so under the directions this one never showed. */}
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          <ExplorationsField label={t('explorations')} addLabel={t('addExploration')} removeLabel={t('removeExploration')} dateLabel={t('explorationDate')} dateHint={t('explorationDateHint')} teamLabel={t('explorationTeam')} teamOptions={teamOptions} descriptionLabel={t('explorationDescription')} notesLabel={t('explorationNotes')} values={form.explorations} onChange={(explorations) => setForm((f) => ({ ...f, explorations }))} labelProps={sectionHeadingProps} />
        </Grid>

          </Grid>
        </FormSection>
        <FormSection>
          <Grid container spacing={2}>

        <Grid size={12}>
          <MapsPicker label={t('maps')} value={form.maps} onChange={(maps) => setForm((f) => ({ ...f, maps }))} sistemaName={form.name || sistemaId} labelProps={sectionHeadingProps} />
        </Grid>
          </Grid>
        </FormSection>
      </Box>

      <StickyActionBar gap={1.5}>
        {/* Deleting a system is for admins (firestore.rules). */}
        {!isNew && isAdmin && (
          <Button color="error" onClick={handleDelete} disabled={saving} sx={{ mr: 'auto' }}>
            {t('delete')}
          </Button>
        )}
        {/* Save while there are changes (Cancel beside it drops them), Exit
            when there's nothing to save. */}
        {isDirty && (
          <Button onClick={onDone} disabled={saving} sx={{ minWidth: 88 }}>
            {t('cancel')}
          </Button>
        )}
        {isDirty ? (
          <Button variant="contained" onClick={handleSave} disabled={saving || !canSave} sx={{ minWidth: 88 }}>
            {t('save')}
          </Button>
        ) : (
          <Button variant="contained" onClick={onDone} disabled={saving} sx={{ minWidth: 88 }}>
            {t('exit')}
          </Button>
        )}
      </StickyActionBar>
      {unsavedChangesDialog}
    </Box>
  )
}
