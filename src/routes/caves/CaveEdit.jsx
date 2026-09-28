import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, Grid, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { ArrowBackRounded, EditRounded, FullscreenExitRounded, FullscreenRounded } from '@mui/icons-material'
import { deleteField } from 'firebase/firestore'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { num, pickDescription } from '@/services/data-service/types.js'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'
import NameTranslationsField from '@/components/NameTranslationsField.jsx'
import CoordinateField from '@/components/ResultPane/CoordinateField.jsx'
import BooleanToggleField from '@/components/ResultPane/BooleanToggleField.jsx'
import CaveMediaTabs from '@/components/ResultPane/CaveMediaTabs.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import StickyActionBar from '@/components/StickyActionBar.jsx'
import OCMap from '@/components/Map/Map.jsx'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')
const accessesModel = createCollectionModel('accesses')
const accessibilitiesModel = createCollectionModel('accessibilities')
const languagesModel = createCollectionModel('languages')

const emptyForm = {
  name: '',
  sistemaId: '',
  source: '',
  access: '',
  accessDetails: '',
  accessibility: '',
  accessibilityDetails: '',
  description: '',
  direction: '',
  fees: false,
  facilities: false,
  activities: false,
  explorationDate: '',
  reporter: '',
  note: '',
  aka: [],
  videos: [],
  nameTranslations: [],
  longitude: '',
  latitude: '',
  entranceLongitude: '',
  entranceLatitude: '',
  keyLongitude: '',
  keyLatitude: '',
}

export default function CaveEdit() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  // descriptions[].lang is a 3-letter code (matching the languages
  // collection / cave nameTranslations), not i18next's own 2-letter code.
  const descriptionLang = ISO6391ToISO6392(i18n.resolvedLanguage) || 'eng'

  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  const [sources] = sourcesModel.useAll()
  const [accesses] = accessesModel.useAll()
  const [accessibilities] = accessibilitiesModel.useAll()
  const [languages] = languagesModel.useAll()
  // Area is a property of the sistema, not something to pick per cave -
  // shown inline in each Sistema option instead of its own field.
  const areasById = new Map(areas.map((a) => [a.id, a.name]))

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  // Kept around only to diff nameTranslations on save (see handleSave) -
  // setDoc's merge:true merges nested maps key-by-key, so a language
  // dropped from the form needs an explicit deleteField() sentinel to
  // actually clear it instead of just being silently omitted.
  const [originalCave, setOriginalCave] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const cave = await CaveModel.getById(caveId)

      if (cancelled) {
        return
      }

      setIsNew(!cave)
      setOriginalCave(cave)
      setForm({
        name: cave?.name?.value || '',
        sistemaId: cave?.sistemaId || '',
        source: cave?.source || '',
        access: cave?.access || '',
        accessDetails: cave?.accessDetails || '',
        accessibility: cave?.accessibility || '',
        accessibilityDetails: cave?.accessibilityDetails || '',
        description: cave?.description || '',
        direction: cave?.direction || '',
        fees: !!cave?.fees,
        facilities: !!cave?.facilities,
        activities: !!cave?.activities,
        explorationDate: cave?.explorationDate || '',
        reporter: cave?.reporter || '',
        note: cave?.note || '',
        aka: cave?.aka || [],
        videos: Array.isArray(cave?.videos) ? cave.videos : typeof cave?.videos === 'string' ? cave.videos.split('|') : [],
        nameTranslations: Object.entries(cave?.nameTranslations || {}).map(([lang, values]) => ({
          lang,
          value: (values || []).join(', '),
        })),
        longitude: normalizeCoordinateValue(cave?.location?.longitude ?? ''),
        latitude: normalizeCoordinateValue(cave?.location?.latitude ?? ''),
        entranceLongitude: normalizeCoordinateValue(cave?.entrance?.longitude ?? ''),
        entranceLatitude: normalizeCoordinateValue(cave?.entrance?.latitude ?? ''),
        keyLongitude: normalizeCoordinateValue(cave?.keys?.[0]?.longitude ?? ''),
        keyLatitude: normalizeCoordinateValue(cave?.keys?.[0]?.latitude ?? ''),
      })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caveId])

  useEffect(() => {
    setTitle(isNew ? t('newCave') : t('caveTitle', { name: form.name || caveId }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude', 'entranceLongitude', 'entranceLatitude', 'keyLongitude', 'keyLatitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const fields = {
        name: { value: form.name },
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
        explorationDate: form.explorationDate || undefined,
        reporter: form.reporter || undefined,
        note: form.note || undefined,
        aka: form.aka.map((s) => s.trim()).filter(Boolean).length > 0 ? form.aka.map((s) => s.trim()).filter(Boolean) : undefined,
        videos: form.videos.map((url) => url.trim()).filter(Boolean),
      }

      if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, 5)), latitude: Number(num(form.latitude, 5)) }
      }

      if (form.entranceLongitude !== '' && form.entranceLatitude !== '') {
        fields.entrance = { longitude: Number(num(form.entranceLongitude, 5)), latitude: Number(num(form.entranceLatitude, 5)) }
      }

      if (form.keyLongitude !== '' && form.keyLatitude !== '') {
        fields.keys = [{ longitude: Number(num(form.keyLongitude, 5)), latitude: Number(num(form.keyLatitude, 5)) }]
      }

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
      Object.keys(originalCave?.nameTranslations || {}).forEach((lang) => {
        if (!(lang in nameTranslationsUpdate)) {
          nameTranslationsUpdate[lang] = deleteField()
        }
      })
      if (Object.keys(nameTranslationsUpdate).length > 0) {
        fields.nameTranslations = nameTranslationsUpdate
      }

      await CaveModel.save(caveId, fields)

      invalidateData()
      await getData()
      // Stays on the form after saving. The saved doc becomes the new
      // baseline for the next save's nameTranslations diff.
      setOriginalCave(await CaveModel.getById(caveId))
      setIsNew(false)
      openSnackbar(tApp('snackbar.saved'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteDialogOpen(false)
    await CaveModel.remove(caveId)
    invalidateData()
    await getData()
    navigate('/caves')
  }

  if (loading) {
    return <Typography className="oc-cave-edit">{t('loading')}</Typography>
  }

  return (
    <div className="oc-cave-edit">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton component={Link} to="/caves" aria-label={t('backToCaves')} sx={{ ml: { xs: 0, sm: -5 } }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5" data-appbar-page-title>
          {isNew ? t('newCave') : t('caveTitle', { name: form.name || caveId })}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label={t('name')} fullWidth required {...field('name')} />

        <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />

        <NameTranslationsField label={t('nameTranslations')} rows={form.nameTranslations} languages={languages} onChange={(nameTranslations) => setForm((f) => ({ ...f, nameTranslations }))} addLabel={t('addNameTranslation')} removeLabel={t('removeNameTranslation')} languageLabel={t('nameTranslationLanguage')} valueLabel={t('nameTranslationValue')} />

        <Divider />

        <CaveMediaTabs caveId={caveId} videos={form.videos} onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))} sistemaId={form.sistemaId} isNew={isNew} standaloneUpload />

        <Divider />

        <Typography variant="subtitle2" component="h2">
          {t('coordinates')}
        </Typography>

        <Grid container spacing={2} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Above the map preview: the fields' own grid overflows a few px
              into it, which otherwise covered part of their buttons. */}
          <Grid size={{ xs: 12, md: 'auto' }} sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, position: 'relative', zIndex: 1 }}>
            <CoordinateField field="location" label={t('location')} longitude={form.longitude} latitude={form.latitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, longitude, latitude }))} />
            <CoordinateField field="entrance" label={t('entrance')} longitude={form.entranceLongitude} latitude={form.entranceLatitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, entranceLongitude: longitude, entranceLatitude: latitude }))} />
            <CoordinateField field="key" label={t('key')} longitude={form.keyLongitude} latitude={form.keyLatitude} onChange={({ longitude, latitude }) => setForm((f) => ({ ...f, keyLongitude: longitude, keyLatitude: latitude }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 'grow' }}>
            {/* Map.jsx's own CSS fills its nearest positioned ancestor with
                a defined height (it's built to fill the whole /map page) -
                this box supplies both so it renders as an inline preview
                here instead. Dragging the pin/fence icons or clicking the
                map still works via the same pickingCoordinateFor/
                editFieldCoordinates redux state CoordinateField itself
                dispatches to.

                Enlarges in place (not a Dialog) so the CoordinateField
                drag-pin/pick-location tools next to it stay reachable and
                aren't hidden behind a dialog backdrop. aspectRatio (not a
                fixed height) keeps it in proportion as it grows to fill
                the width freed up by the coordinates column shrinking to
                its content width. */}
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: mapExpanded ? '4 / 3' : '16 / 9', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', transition: (theme) => theme.transitions.create('aspect-ratio') }}>
              <Tooltip title={mapExpanded ? t('shrinkMap') : t('enlargeMap')}>
                <IconButton size="small" onClick={() => setMapExpanded((v) => !v)} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
                  {mapExpanded ? <FullscreenExitRounded fontSize="small" /> : <FullscreenRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
              <OCMap />
            </Box>
          </Grid>
        </Grid>

        <Divider />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" component="h2">
            {t('sistemaGroup')}
          </Typography>
          <Tooltip title={t('editSistemas')}>
            <IconButton component={Link} to="/sistemas" size="small" aria-label={t('editSistemas')}>
              <EditRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <TextField select label={t('sistema')} fullWidth {...field('sistemaId')}>
          <MenuItem value="">{t('none')}</MenuItem>
          {form.sistemaId && !sistemas.some((s) => s.id === form.sistemaId) && (
            <MenuItem value={form.sistemaId} sx={{ display: 'none' }}>
              {form.sistemaId}
            </MenuItem>
          )}
          {[...sistemas]
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
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

        <Typography variant="subtitle2" component="h2">
          {t('accessGroup')}
        </Typography>
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

        <Typography variant="subtitle2" component="h2">
          {t('accessibilityGroup')}
        </Typography>
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

        <Divider />

        <TextField label={t('note')} fullWidth multiline minRows={2} sx={{ '& textarea': { resize: 'vertical' } }} {...field('note')} />
      </Box>

      <StickyActionBar gap={1}>
        {!isNew && (
          <Button color="error" onClick={() => setDeleteDialogOpen(true)} disabled={saving} sx={{ mr: 'auto' }}>
            {t('delete')}
          </Button>
        )}
        <Button onClick={() => navigate('/caves')} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
          {t('save')}
        </Button>
      </StickyActionBar>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('deleteCave')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('deleteCaveConfirm', { name: form.name || caveId })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('cancel')}</Button>
          <Button color="error" onClick={handleDelete}>
            {t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
