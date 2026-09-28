import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, ListSubheader, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { EditRounded } from '@mui/icons-material'
import { deleteField } from 'firebase/firestore'
import { clearCurrentCave } from '@/redux/slices/mapSlice.jsx'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import SharedMarkdownField from '@/components/Markdown/MarkdownField.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'
import NameTranslationsField from '@/components/NameTranslationsField.jsx'
import { num, pickDescription, squaredDistance } from '@/services/data-service/types.js'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import CoordinateField from './CoordinateField.jsx'
import BooleanToggleField from './BooleanToggleField.jsx'
import CaveMediaTabs from './CaveMediaTabs.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import { useSmall } from '@/hooks/useSmall.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')
const accessesModel = createCollectionModel('accesses')
const accessibilitiesModel = createCollectionModel('accessibilities')
const languagesModel = createCollectionModel('languages')

function MarkdownField({ label, value, onChange, minRows, resizable }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  return <SharedMarkdownField label={label} value={value} onChange={onChange} minRows={minRows} resizable={resizable} placeholder={t('emptyPreview')} />
}

// Lighter-weight companion to routes/caves/CaveEdit.jsx: the same map/pane
// layout as the read-only view (CurrentCaveDetailsContent), swapped for
// editable fields, for quick in-context tweaks without leaving the map.
// Covers the fields an editor is likely to touch often; the full field set
// (aka, rating, reporter, note, exploration date, cover image) stays in the
// dedicated admin form.
export default function CurrentCaveDetailsContentEdit({ cave }) {
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isSmall = useSmall()
  // The map's "place on map" mode takes over the screen: no Save bar then.
  const placingOnMap = useSelector((state) => !!state.map.placeOnMap)
  // descriptions[].lang is a 3-letter code (matching the languages
  // collection / cave nameTranslations), not i18next's own 2-letter code.
  const descriptionLang = ISO6391ToISO6392(i18n.resolvedLanguage) || 'eng'
  // Sorts the Sistema dropdown nearest-first, live as the map is panned.
  const mapCenter = useSelector((state) => state.map.viewState)

  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [accesses] = accessesModel.useAll()
  const [accessibilities] = accessibilitiesModel.useAll()
  const [languages] = languagesModel.useAll()
  // Area is a property of the sistema, not something to pick per cave -
  // shown inline in each Sistema option instead of its own field.
  const areasById = new Map(areas.map((a) => [a.id, a.name]))
  const [sistemaSearch, setSistemaSearch] = useState('')
  const sistemaSearchInputRef = useRef(null)

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
    videos: Array.isArray(cave.videos) ? cave.videos : typeof cave.videos === 'string' ? cave.videos.split('|') : [],
    sistemaId: cave.sistemaId || '',
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
    keyLongitude: normalizeCoordinateValue(cave.keys?.[0]?.longitude ?? ''),
    keyLatitude: normalizeCoordinateValue(cave.keys?.[0]?.latitude ?? ''),
    nameTranslations: Object.entries(cave.nameTranslations || {}).map(([lang, values]) => ({
      lang,
      value: (values || []).join(', '),
    })),
  }))
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    }
  }

  function exitEditMode() {
    // replace: true so Cancel/Save never leave a stray edit-mode entry
    // behind in history - closing should be a one-way exit, not something
    // a later back-navigation could reopen.
    navigate(`/map/${cave.id}`, { replace: true })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const trimmedAka = form.aka.map((s) => s.trim()).filter(Boolean)

      const fields = {
        name: { value: form.name },
        aka: trimmedAka.length > 0 ? trimmedAka : undefined,
        videos: form.videos.map((url) => url.trim()).filter(Boolean),
        sistemaId: form.sistemaId || undefined,
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

      if (form.keyLongitude === '' && form.keyLatitude === '' && cave.keys?.length) {
        fields.keys = deleteField()
      } else if (form.keyLongitude !== '' && form.keyLatitude !== '') {
        fields.keys = [{ longitude: Number(num(form.keyLongitude, 5)), latitude: Number(num(form.keyLatitude, 5)) }]
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

  async function handleDelete() {
    setDeleteDialogOpen(false)
    setSaving(true)
    try {
      await CaveModel.remove(cave.id)
      invalidateData()
      await getData()
      dispatch(clearCurrentCave())
      navigate('/map', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  // On phones the form lives in Ionic's sheet, which is always
  // window.innerHeight tall and slid down (see AGENTS.md): a sticky bar would
  // stick to the sheet's off-screen bottom, and position: fixed would be
  // relative to its transformed wrapper. So there the bar is portaled to
  // <body> and pinned to the viewport - above the sheet (z-index 999), below
  // dialogs and menus - and the form gets room to scroll its last fields
  // clear of it. On wider screens it stays sticky within the pane.
  const saveBar = (
    <Box
      className="oc-current-cave-details-content-edit--actions"
      sx={
        isSmall
          ? (theme) => ({ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: theme.zIndex.appBar, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', px: 'var(--oc-pane-padding-inline)', pt: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))' })
          : { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, width: '100%', position: 'sticky', bottom: 0, bgcolor: 'background.paper', pt: 2, mt: 1, pb: 1 }
      }
    >
      <Button color="error" onClick={() => setDeleteDialogOpen(true)} disabled={saving} sx={{ mr: 'auto', minWidth: 88 }}>
        {t('delete')}
      </Button>
      <Button onClick={exitEditMode} disabled={saving} sx={{ minWidth: 88 }}>
        {t('cancel')}
      </Button>
      <Button variant="contained" onClick={handleSave} disabled={saving || !form.name} sx={{ minWidth: 88 }}>
        {t('save')}
      </Button>
    </Box>
  )

  // M3 touch sizing for the whole form on phones (it's built from dense,
  // desktop-sized controls shared with the admin pages): 48dp targets with
  // 24dp icons for icon buttons, 40dp-tall buttons, standard-size switches.
  const phoneTouchSizing = {
    '& .MuiIconButton-root': { width: 48, height: 48, p: 0 },
    '& .MuiIconButton-root .MuiSvgIcon-root': { fontSize: 24 },
    '& .MuiButton-root': { minHeight: 40 },
  }

  return (
    <Box className="oc-current-cave-details-content-edit oc-result-pane--content" sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 'var(--oc-pane-padding-inline)', ...(isSmall && { pb: 'calc(var(--oc-pane-padding-inline) + 72px + env(safe-area-inset-bottom))', ...phoneTouchSizing }) }}>
      <TextField label={t('name')} fullWidth required {...field('name')} />

      <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />

      <NameTranslationsField label={t('nameTranslations')} rows={form.nameTranslations} languages={languages} onChange={(nameTranslations) => setForm((f) => ({ ...f, nameTranslations }))} addLabel={t('addNameTranslation')} removeLabel={t('removeNameTranslation')} languageLabel={t('nameTranslationLanguage')} valueLabel={t('nameTranslationValue')} />

      <Divider />

      <CaveMediaTabs caveId={cave.id} videos={form.videos} onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))} sistemaId={form.sistemaId} />

      <Divider />

      <Typography variant="subtitle2" component="h2">{t('coordinates')}</Typography>

      <CoordinateField field="location" label={t('location')} longitude={form.longitude} latitude={form.latitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude }))} />
      <CoordinateField field="entrance" label={t('entrance')} longitude={form.entranceLongitude} latitude={form.entranceLatitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, entranceLongitude: longitude, entranceLatitude: latitude }))} />
      <CoordinateField field="key" label={t('key')} longitude={form.keyLongitude} latitude={form.keyLatitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, keyLongitude: longitude, keyLatitude: latitude }))} />

      <Divider />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" component="h2">{t('sistemaGroup')}</Typography>
        <Tooltip title={t('editSistemas')}>
          <IconButton component={Link} to="sistemas" size="small" aria-label={t('editSistemas')}>
            <EditRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <TextField
        select
        label={t('sistema')}
        fullWidth
        {...field('sistemaId')}
        slotProps={{
          select: {
            // A fixed width keeps the menu from resizing horizontally as
            // the filtered list changes. The search itself is only cleared
            // once the close transition has fully finished (onExited, not
            // onClose) - clearing it any earlier would repopulate the full
            // list while the menu is still visibly fading out.
            MenuProps: {
              autoFocus: false,
              slotProps: {
                paper: { sx: { width: 320 } },
                transition: { onExited: () => setSistemaSearch('') },
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
          <TextField inputRef={sistemaSearchInputRef} autoFocus size="small" fullWidth placeholder={t('sistemaSearchPlaceholder')} value={sistemaSearch} onChange={(e) => setSistemaSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
        </ListSubheader>
        <MenuItem value="">{t('none')}</MenuItem>
        {form.sistemaId && !sistemas.some((s) => s.id === form.sistemaId) && (
          <MenuItem value={form.sistemaId} sx={{ display: 'none' }}>
            {form.sistemaId}
          </MenuItem>
        )}
        {[...sistemas]
          .sort((a, b) => squaredDistance(a.location, mapCenter) - squaredDistance(b.location, mapCenter) || (a.name || '').localeCompare(b.name || ''))
          .filter((s) => {
            const q = sistemaSearch.trim().toLowerCase()
            return s.id === form.sistemaId || !q || (s.name || s.id).toLowerCase().includes(q) || (areasById.get(s.area) || '').toLowerCase().includes(q)
          })
          .map((s) => (
            <MenuItem key={s.id} value={s.id}>
              <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: 0.5, bgcolor: s.color || SISTEMA_DEFAULT_COLOR, border: '1px solid', borderColor: 'divider', mr: 1, flexShrink: 0 }} />
              {s.name || s.id}
              {areasById.get(s.area) && (
                <Typography component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>
                  ({areasById.get(s.area)})
                </Typography>
              )}
            </MenuItem>
          ))}
      </TextField>

      <TextField select label={t('source')} helperText={t('sourceHint')} fullWidth {...field('source')}>
        <MenuItem value="">{t('none')}</MenuItem>
        {form.source && !sources.some((s) => s.id === form.source) && (
          <MenuItem value={form.source} sx={{ display: 'none' }}>
            {form.source}
          </MenuItem>
        )}
        {sources.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>

      <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} minRows={5} resizable />
      <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} minRows={5} resizable />

      <Divider />

      <Typography variant="subtitle2" component="h2">{t('accessGroup')}</Typography>
      <TextField select label={t('access')} fullWidth {...field('access')} slotProps={{ select: { renderValue: (value) => accesses.find((a) => a.id === value)?.name || '' } }}>
        <MenuItem value="">{t('none')}</MenuItem>
        {form.access && !accesses.some((a) => a.id === form.access) && (
          <MenuItem value={form.access} sx={{ display: 'none' }}>
            {form.access}
          </MenuItem>
        )}
        {accesses.map((a) => (
          <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body1">{a.name}</Typography>
            {pickDescription(a.descriptions, descriptionLang) && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {pickDescription(a.descriptions, descriptionLang)}
              </Typography>
            )}
          </MenuItem>
        ))}
      </TextField>
      <MarkdownField label={t('accessDetails')} value={form.accessDetails} onChange={(e) => setForm((f) => ({ ...f, accessDetails: e.target.value }))} resizable />

      <Divider />
      <Typography variant="subtitle2" component="h2">{t('accessibilityGroup')}</Typography>
      <TextField select label={t('accessibility')} fullWidth {...field('accessibility')} slotProps={{ select: { renderValue: (value) => accessibilities.find((a) => a.id === value)?.name || '' } }}>
        <MenuItem value="">{t('none')}</MenuItem>
        {form.accessibility && !accessibilities.some((a) => a.id === form.accessibility) && (
          <MenuItem value={form.accessibility} sx={{ display: 'none' }}>
            {form.accessibility}
          </MenuItem>
        )}
        {accessibilities.map((a) => (
          <MenuItem key={a.id} value={a.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body1">{a.name}</Typography>
            {pickDescription(a.descriptions, descriptionLang) && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {pickDescription(a.descriptions, descriptionLang)}
              </Typography>
            )}
          </MenuItem>
        ))}
      </TextField>
      <MarkdownField label={t('accessibilityDetails')} value={form.accessibilityDetails} onChange={(e) => setForm((f) => ({ ...f, accessibilityDetails: e.target.value }))} resizable />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <BooleanToggleField name="fees" value={form.fees} onChange={(fees) => setForm((f) => ({ ...f, fees }))} />
        <BooleanToggleField name="facilities" value={form.facilities} onChange={(facilities) => setForm((f) => ({ ...f, facilities }))} />
        <BooleanToggleField name="activities" value={form.activities} onChange={(activities) => setForm((f) => ({ ...f, activities }))} />
      </Box>

      {isSmall ? !placingOnMap && createPortal(saveBar, document.body) : saveBar}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('deleteCave')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('deleteCaveConfirm', { name: form.name || cave.id })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button color="error" onClick={handleDelete} disabled={saving}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
