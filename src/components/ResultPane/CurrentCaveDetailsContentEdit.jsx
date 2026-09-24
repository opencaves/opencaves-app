import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Button, Checkbox, Divider, FormControlLabel, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { AddRounded, CloseRounded } from '@mui/icons-material'
import { deleteField } from 'firebase/firestore'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import Markdown from '@/components/Markdown/Markdown.jsx'
import { num, pickDescription } from '@/services/data-service/types.js'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import ColorPickerField from './ColorPickerField.jsx'
import CoordinateField from './CoordinateField.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')
const accessesModel = createCollectionModel('accesses')
const accessibilitiesModel = createCollectionModel('accessibilities')
const languagesModel = createCollectionModel('languages')

function RepeatableTextField({ label, values, onChange, addLabel, removeLabel }) {
  function updateAt(index, value) {
    onChange(values.map((v, i) => (i === index ? value : v)))
  }

  function removeAt(index) {
    onChange(values.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...values, ''])
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {values.map((value, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" fullWidth value={value} onChange={(e) => updateAt(index, e.target.value)} />
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddRounded />} onClick={add} sx={{ alignSelf: 'flex-start' }}>
          {addLabel}
        </Button>
      </Box>
    </Box>
  )
}

// One row per language, each language selectable in at most one row at a
// time (its own current selection stays available to itself, but disappears
// from every other row's options once picked).
function NameTranslationsField({ label, rows, languages, onChange, addLabel, removeLabel, languageLabel, valueLabel }) {
  const usedLangs = rows.map((r) => r.lang).filter(Boolean)
  const unusedLanguages = languages.filter((l) => !usedLangs.includes(l.code))

  function updateAt(index, patch) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeAt(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...rows, { lang: unusedLanguages[0].code, value: '' }])
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((row, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField select size="small" label={languageLabel} sx={{ width: 160, flexShrink: 0 }} value={row.lang} onChange={(e) => updateAt(index, { lang: e.target.value })}>
              {languages
                .filter((l) => l.code === row.lang || !usedLangs.includes(l.code))
                .map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.eng}
                  </MenuItem>
                ))}
            </TextField>
            <TextField size="small" label={valueLabel} fullWidth value={row.value} onChange={(e) => updateAt(index, { value: e.target.value })} />
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddRounded />} onClick={add} disabled={unusedLanguages.length === 0} sx={{ alignSelf: 'flex-start' }}>
          {addLabel}
        </Button>
      </Box>
    </Box>
  )
}

function MarkdownField({ label, value, onChange, minRows = 3, resizable = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })

  return (
    <Box>
      <TextField label={label} fullWidth multiline minRows={minRows} value={value} onChange={onChange} sx={resizable ? { '& textarea': { resize: 'vertical' } } : undefined} />
      {value && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('preview')}
          </Typography>
          <Markdown>{value}</Markdown>
        </Box>
      )}
    </Box>
  )
}

// Lighter-weight companion to routes/caves/CaveEdit.jsx: the same map/pane
// layout as the read-only view (CurrentCaveDetailsContent), swapped for
// editable fields, for quick in-context tweaks without leaving the map.
// Covers the fields an editor is likely to touch often; the full field set
// (aka, maps, rating, reporter, note, exploration date, cover image) stays
// in the dedicated admin form.
export default function CurrentCaveDetailsContentEdit({ cave }) {
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const navigate = useNavigate()
  // descriptions[].lang is a 3-letter code (matching the languages
  // collection / cave nameTranslations), not i18next's own 2-letter code.
  const descriptionLang = ISO6391ToISO6392(i18n.resolvedLanguage) || 'eng'

  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [accesses] = accessesModel.useAll()
  const [accessibilities] = accessibilitiesModel.useAll()
  const [languages] = languagesModel.useAll()

  function normalizeCoordinateValue(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return ''
    }

    const normalized = Number(num(value, 5))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  const [form, setForm] = useState(() => ({
    name: cave.name?.value || '',
    aka: cave.aka || [],
    sistemaId: cave.sistemaId || '',
    sistemaColor: cave.sistemaColor || '',
    area: cave.area || '',
    source: cave.source || '',
    access: cave.access || '',
    accessDetails: cave.accessDetails || '',
    accessibility: cave.accessibility || '',
    accessibilityDetails: cave.accessibilityDetails || '',
    description: cave.description || '',
    direction: cave.direction || '',
    fees: !!cave.fees,
    facilities: !!cave.facilities,
    activities: !!cave.activities,
    longitude: normalizeCoordinateValue(cave.location?.longitude ?? ''),
    latitude: normalizeCoordinateValue(cave.location?.latitude ?? ''),
    entranceLongitude: normalizeCoordinateValue(cave.entrance?.longitude ?? ''),
    entranceLatitude: normalizeCoordinateValue(cave.entrance?.latitude ?? ''),
    nameTranslations: Object.entries(cave.nameTranslations || {}).map(([lang, values]) => ({
      lang,
      value: (values || []).join(', '),
    })),
  }))
  const [saving, setSaving] = useState(false)
  const [showFooterShadow, setShowFooterShadow] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    const node = contentRef.current
    if (!node) {
      return undefined
    }

    const updateShadow = () => {
      const container = node.parentElement
      const hasScroll = container && container.scrollHeight > container.clientHeight + 1
      setShowFooterShadow(hasScroll)
    }

    updateShadow()

    const resizeObserver = new ResizeObserver(updateShadow)
    resizeObserver.observe(node)

    if (node.parentElement) {
      resizeObserver.observe(node.parentElement)
    }

    return () => resizeObserver.disconnect()
  }, [])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    }
  }

  function exitEditMode() {
    navigate(`/map/${cave.id}`)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const trimmedAka = form.aka.map((s) => s.trim()).filter(Boolean)

      const fields = {
        name: { value: form.name },
        aka: trimmedAka.length > 0 ? trimmedAka : undefined,
        sistemaId: form.sistemaId || undefined,
        sistemaColor: form.sistemaColor || undefined,
        area: form.area || undefined,
        source: form.source || undefined,
        access: form.access || undefined,
        accessDetails: form.accessDetails || undefined,
        accessibility: form.accessibility || undefined,
        accessibilityDetails: form.accessibilityDetails || undefined,
        description: form.description || undefined,
        direction: form.direction || undefined,
        fees: form.fees,
        facilities: form.facilities,
        activities: form.activities,
      }

      if (form.longitude === '' && form.latitude === '' && cave.location) {
        fields.location = deleteField()
      } else if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, 5)), latitude: Number(num(form.latitude, 5)) }
      }

      if (form.entranceLongitude === '' && form.entranceLatitude === '' && cave.entrance) {
        fields.entrance = deleteField()
      } else if (form.entranceLongitude !== '' && form.entranceLatitude !== '') {
        fields.entrance = { longitude: Number(num(form.entranceLongitude, 5)), latitude: Number(num(form.entranceLatitude, 5)) }
      }

      // setDoc's merge:true merges nested map fields key-by-key rather than
      // replacing the whole nameTranslations map, so a language dropped from
      // the form needs an explicit deleteField() sentinel to actually clear
      // it - just omitting it here would leave its old value untouched.
      const nameTranslationsUpdate = {}
      form.nameTranslations.forEach(({ lang, value }) => {
        const trimmed = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (lang && trimmed.length > 0) {
          nameTranslationsUpdate[lang] = trimmed
        }
      })
      Object.keys(cave.nameTranslations || {}).forEach((lang) => {
        if (!(lang in nameTranslationsUpdate)) {
          nameTranslationsUpdate[lang] = deleteField()
        }
      })
      if (Object.keys(nameTranslationsUpdate).length > 0) {
        fields.nameTranslations = nameTranslationsUpdate
      }

      await CaveModel.save(cave.id, fields)
      invalidateData()
      await getData()
      exitEditMode()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box ref={contentRef} className="oc-result-pane--content" sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 'var(--oc-pane-padding-inline)' }}>
      <TextField label={t('name')} fullWidth required {...field('name')} />

      <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />

      <NameTranslationsField label={t('nameTranslations')} rows={form.nameTranslations} languages={languages} onChange={(nameTranslations) => setForm((f) => ({ ...f, nameTranslations }))} addLabel={t('addNameTranslation')} removeLabel={t('removeNameTranslation')} languageLabel={t('nameTranslationLanguage')} valueLabel={t('nameTranslationValue')} />

      <Divider />

      <Typography variant="subtitle2">{t('coordinates')}</Typography>

      <CoordinateField field="location" label={t('location')} longitude={form.longitude} latitude={form.latitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude }))} />
      <CoordinateField field="entrance" label={t('entrance')} longitude={form.entranceLongitude} latitude={form.entranceLatitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, entranceLongitude: longitude, entranceLatitude: latitude }))} />

      <Divider />

      <Typography variant="subtitle2">{t('sistemaGroup')}</Typography>
      <TextField select label={t('sistema')} fullWidth {...field('sistemaId')}>
        <MenuItem value="">{t('none')}</MenuItem>
        {[...sistemas]
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name || s.id}
            </MenuItem>
          ))}
      </TextField>
      <ColorPickerField label={t('sistemaColor')} value={form.sistemaColor} onChange={(hex) => setForm((f) => ({ ...f, sistemaColor: hex }))} />

      <TextField select label={t('area')} fullWidth {...field('area')}>
        <MenuItem value="">{t('none')}</MenuItem>
        {areas.map((a) => (
          <MenuItem key={a.id} value={a.id}>
            {a.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label={t('source')} fullWidth {...field('source')}>
        <MenuItem value="">{t('none')}</MenuItem>
        {sources.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>

      <Divider />

      <Typography variant="subtitle2">{t('accessGroup')}</Typography>
      <TextField select label={t('access')} fullWidth {...field('access')} slotProps={{ select: { renderValue: (value) => accesses.find((a) => a.id === value)?.name || '' } }}>
        <MenuItem value="">{t('none')}</MenuItem>
        {accesses.map((a) => (
          <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body1">{a.name}</Typography>
            {pickDescription(a.descriptions, descriptionLang) && (
              <Typography variant="body2" color="text.secondary">
                {pickDescription(a.descriptions, descriptionLang)}
              </Typography>
            )}
          </MenuItem>
        ))}
      </TextField>
      <MarkdownField label={t('accessDetails')} value={form.accessDetails} onChange={(e) => setForm((f) => ({ ...f, accessDetails: e.target.value }))} />

      <Divider />
      <Typography variant="subtitle2">{t('accessibilityGroup')}</Typography>
      <TextField select label={t('accessibility')} fullWidth {...field('accessibility')} slotProps={{ select: { renderValue: (value) => accessibilities.find((a) => a.id === value)?.name || '' } }}>
        <MenuItem value="">{t('none')}</MenuItem>
        {accessibilities.map((a) => (
          <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body1">{a.name}</Typography>
            {pickDescription(a.descriptions, descriptionLang) && (
              <Typography variant="body2" color="text.secondary">
                {pickDescription(a.descriptions, descriptionLang)}
              </Typography>
            )}
          </MenuItem>
        ))}
      </TextField>
      <MarkdownField label={t('accessibilityDetails')} value={form.accessibilityDetails} onChange={(e) => setForm((f) => ({ ...f, accessibilityDetails: e.target.value }))} />

      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
        <Tooltip title={t('feesHint')}>
          <FormControlLabel control={<Checkbox checked={form.fees} onChange={(e) => setForm((f) => ({ ...f, fees: e.target.checked }))} />} label={t('fees')} />
        </Tooltip>
        <Tooltip title={t('facilitiesHint')}>
          <FormControlLabel control={<Checkbox checked={form.facilities} onChange={(e) => setForm((f) => ({ ...f, facilities: e.target.checked }))} />} label={t('facilities')} />
        </Tooltip>
        <Tooltip title={t('activitiesHint')}>
          <FormControlLabel control={<Checkbox checked={form.activities} onChange={(e) => setForm((f) => ({ ...f, activities: e.target.checked }))} />} label={t('activities')} />
        </Tooltip>
      </Box>

      <Divider />

      <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} minRows={5} resizable />
      <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} minRows={5} resizable />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, width: '100%', position: 'sticky', bottom: 0, bgcolor: 'background.paper', pt: 2, mt: 1, pb: 1, boxShadow: showFooterShadow ? '0 -6px 16px -12px rgba(0,0,0,0.4)' : 'none' }}>
        <Button onClick={exitEditMode} disabled={saving} sx={{ minWidth: 88 }}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name} sx={{ minWidth: 88 }}>
          {t('save')}
        </Button>
      </Box>
    </Box>
  )
}
