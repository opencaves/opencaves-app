import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { orDelete } from '@/utils/firestoreFields.js'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { deleteField } from 'firebase/firestore'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.jsx'
import { CAVE_TEXT_FIELDS, textSourcesOf, textSourcesUpdate, withTextChange } from '@/utils/textSources.js'
import TextSourceField from '@/components/TextSourceField.jsx'
import { formSectionHeadingProps } from '@/components/formSectionHeading.js'
import FormSection from '@/components/FormSection.jsx'
import { num, pickDescription } from '@/services/data-service/types.js'
import { toContentLanguage } from '@/utils/lang.js'
import { DEFAULT_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'
import { SISTEMA_DEFAULT_COLOR, COORDINATE_DECIMALS } from '@/config/map.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'
import NameTranslationsField from '@/components/NameTranslationsField.jsx'
import CoordinateFieldList, { caveCoordinateItems } from '@/components/ResultPane/CoordinateFieldList.jsx'
import BooleanToggleField from '@/components/ResultPane/BooleanToggleField.jsx'
import CaveMediaTabs from '@/components/ResultPane/CaveMediaTabs.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import StickyActionBar from '@/components/StickyActionBar.jsx'
import CoordinatesMapPreview from '@/components/CoordinatesMapPreview.jsx'
import EditPageHeader from '@/components/EditPageHeader.jsx'
import SourceSelect from '@/components/SourceSelect.jsx'
import FormSkeleton from '@/components/Skeletons/FormSkeleton.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { FIT_SELECT_MENU_PROPS, fitSelectSx } from '@/utils/fitSelect.js'

const sectionHeadingProps = formSectionHeadingProps('oc-cave-edit--section-title')
// For a heading placed directly in the form's column, whose 16dp gap already
// separates it from what follows: 8dp more makes the same 24dp as a field's
// own heading (labelProps).
const columnHeadingProps = { ...sectionHeadingProps, sx: { ...sectionHeadingProps.sx, mb: 1 } }

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
  textSources: {},
  cenoteEntrance: false,
  fees: false,
  facilities: false,
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
  locationValidity: 'valid',
  entranceValidity: 'valid',
  keyValidity: 'valid',
}

export default function CaveEdit() {
  const { caveId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  // descriptions[].lang is a 3-letter code (matching the languages
  // collection / cave nameTranslations), not i18next's own 2-letter code.
  const descriptionLang = toContentLanguage(i18n.resolvedLanguage) || DEFAULT_CONTENT_LANGUAGE

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

    const normalized = Number(num(value, COORDINATE_DECIMALS))
    return Number.isFinite(normalized) ? String(normalized) : ''
  }

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // Deleting a cave: admins only (as in firestore.rules).
  const isAdmin = useSelector((state) => state.session.roles).includes('admin')
  // Kept around only to diff nameTranslations on save (see handleSave) -
  // setDoc's merge:true merges nested maps key-by-key, so a language
  // dropped from the form needs an explicit deleteField() sentinel to
  // actually clear it instead of just being silently omitted.
  const [originalCave, setOriginalCave] = useState(null)
  const { isDirty, setBaseline, discardChanges, unsavedChangesDialog } = useUnsavedChanges(form, { onSave: handleSave, canSave: !!form.name, within: `/caves/${caveId}/edit` })

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
      const loaded = {
        name: cave?.name?.value || '',
        sistemaId: cave?.sistemaId || '',
        source: cave?.source || '',
        access: cave?.access || '',
        accessDetails: cave?.accessDetails || '',
        accessibility: cave?.accessibility || '',
        accessibilityDetails: cave?.accessibilityDetails || '',
        description: cave?.description || '',
        direction: cave?.direction || '',
        textSources: textSourcesOf(cave, CAVE_TEXT_FIELDS),
        cenoteEntrance: !!cave?.cenoteEntrance,
        fees: !!cave?.fees,
        facilities: !!cave?.facilities,
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
        // Each coordinate's validity: one without it is unconfirmed.
        locationValidity: cave?.location?.validity || 'unknown',
        entranceValidity: cave?.entrance?.validity || 'unknown',
        keyValidity: cave?.keys?.[0]?.validity || 'unknown',
      }
      setForm(loaded)
      setBaseline(loaded)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caveId])

  useEffect(() => {
    // Every edit page's title says so ("Edit …"); a new one stays "New …".
    setTitle(isNew ? t('newCave') : tApp('editTitle', { title: t('caveTitle', { name: form.name || caveId }) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name, t, tApp])

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: ['longitude', 'latitude', 'entranceLongitude', 'entranceLatitude', 'keyLongitude', 'keyLatitude'].includes(name) ? normalizeCoordinateValue(e.target.value) : e.target.value })),
    }
  }

  async function handleSave() {
    const savedForm = form
    setSaving(true)
    try {
      const fields = {
        // The texts' sources the form changed (textSources).
        textSources: textSourcesUpdate(originalCave, form, CAVE_TEXT_FIELDS),
        name: { value: form.name },
        sistemaId: orDelete(form.sistemaId),
        source: orDelete(form.source),
        access: orDelete(form.access),
        accessDetails: orDelete(form.accessDetails),
        accessibility: orDelete(form.accessibility),
        accessibilityDetails: orDelete(form.accessibilityDetails),
        description: orDelete(form.description),
        direction: orDelete(form.direction),
        cenoteEntrance: form.cenoteEntrance,
        fees: form.fees,
        facilities: form.facilities,
        explorationDate: orDelete(form.explorationDate),
        reporter: orDelete(form.reporter),
        note: orDelete(form.note),
        aka: orDelete(form.aka.map((s) => s.trim()).filter(Boolean)),
        videos: form.videos.map((url) => url.trim()).filter(Boolean),
      }

      // Emptied coordinates are removed, as in the map pane's form.
      if (form.longitude === '' && form.latitude === '' && originalCave?.location) {
        fields.location = deleteField()
      } else if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, COORDINATE_DECIMALS)), latitude: Number(num(form.latitude, COORDINATE_DECIMALS)), validity: form.locationValidity }
      }

      if (form.entranceLongitude === '' && form.entranceLatitude === '' && originalCave?.entrance) {
        fields.entrance = deleteField()
      } else if (form.entranceLongitude !== '' && form.entranceLatitude !== '') {
        fields.entrance = { longitude: Number(num(form.entranceLongitude, COORDINATE_DECIMALS)), latitude: Number(num(form.entranceLatitude, COORDINATE_DECIMALS)), validity: form.entranceValidity }
      }

      if (form.keyLongitude === '' && form.keyLatitude === '' && originalCave?.keys?.length) {
        fields.keys = deleteField()
      } else if (form.keyLongitude !== '' && form.keyLatitude !== '') {
        fields.keys = [{ longitude: Number(num(form.keyLongitude, COORDINATE_DECIMALS)), latitude: Number(num(form.keyLatitude, COORDINATE_DECIMALS)), validity: form.keyValidity }]
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

      // Offline, kept on the device and synced later (useSettleWrite says so).
      const status = await settleWrite(CaveModel.save(caveId, fields), { name: t('caveTitle', { name: form.name || caveId }) })
      setBaseline(savedForm)
      setIsNew(false)
      // Stays on the form after saving. The saved doc becomes the new
      // baseline for the next save's nameTranslations diff. Awaited once the
      // server confirmed; offline, in the background (the device's copy).
      const refresh = async () => {
        invalidateData()
        await getData()
        setOriginalCave(await CaveModel.getById(caveId))
      }
      if (status === 'saved') {
        await refresh()
        openSnackbar(tApp('snackbar.saved', { name: t('caveTitle', { name: form.name || caveId }) }), { severity: 'success' })
      } else refresh().catch((error) => console.warn(error))
    } catch (error) {
      // Nothing saved: say so, and leave the form as it is (still changed).
      console.error(error)
      openSnackbar(tApp('snackbar.saveError', { name: t('caveTitle', { name: form.name || caveId }) }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteDialogOpen(false)
    const name = t('caveTitle', { name: form.name || caveId })
    const removal = CaveModel.remove(caveId)
    // Offline, Firestore only settles the delete once the server has it: it's
    // done on the device now, said so, and an error later still told.
    if (!navigator.onLine) {
      removal.catch((error) => {
        console.error(error)
        openSnackbar(t('caveDeleteError', { name }))
      })
      openSnackbar(t('caveDeletedOffline', { name }), { severity: 'success' })
    } else {
      try {
        await removal
      } catch (error) {
        // Nothing deleted: the form stays.
        console.error(error)
        openSnackbar(t('caveDeleteError', { name }))
        return
      }
      openSnackbar(t('caveDeleted', { name }), { severity: 'success' })
    }
    discardChanges()
    invalidateData()
    getData().catch((error) => console.warn(error))
    navigate('/caves')
  }

  if (loading) {
    // Like the form: the name on the page, then aka, name translations,
    // media, coordinates, cave system and description, each on its card.
    return (
      <FormSkeleton
        className="oc-cave-edit"
        lead={['100%']}
        sections={[
          { title: true, fields: [{ kind: 'button' }] },
          { title: true, fields: ['100%', { kind: 'button' }] },
          { title: true, fields: [{ kind: 'tabs' }] },
          { title: true, fields: ['min(100%, 340px)', 'min(100%, 340px)', 'min(100%, 340px)'] },
          { title: true, fields: ['100%'] },
          { title: true, fields: [{ kind: 'markdown', height: 140 }] },
        ]}
      />
    )
  }

  return (
    <div className="oc-cave-edit">
      <EditPageHeader>
        {/* Ends edit mode: up to the cave's page (a new cave has none yet: the caves). */}
        <IconButton component={Link} to={isNew ? '/caves' : '..'} relative="path" aria-label={isNew ? t('backToCaves') : t('backToCave')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5" data-appbar-page-title>
          {isNew ? t('newCave') : t('caveTitle', { name: form.name || caveId })}
        </Typography>
      </EditPageHeader>

      {/* Each section on its own opaque card (FormSection), on the dashboard's
          translucent page. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* The name on the page itself, the sections below on cards. */}
        <TextField label={t('name')} fullWidth required {...field('name')} />
        <FormSection>

        <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} labelProps={sectionHeadingProps} />

        </FormSection>
        <FormSection>

        <NameTranslationsField label={t('nameTranslations')} rows={form.nameTranslations} languages={languages} onChange={(nameTranslations) => setForm((f) => ({ ...f, nameTranslations }))} addLabel={t('addNameTranslation')} removeLabel={t('removeNameTranslation')} languageLabel={t('nameTranslationLanguage')} valueLabel={t('nameTranslationValue')} labelProps={sectionHeadingProps} />

        </FormSection>
        <FormSection>

        <Typography {...columnHeadingProps}>{t('media')}</Typography>
        <CaveMediaTabs caveId={caveId} videos={form.videos} onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))} sistemaId={form.sistemaId} isNew={isNew} standaloneUpload galleryPath={`/caves/${caveId}/edit`} />

        </FormSection>
        <FormSection>

        <Typography {...columnHeadingProps}>{t('coordinates')}</Typography>

        <Grid container spacing={2} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Above the map preview beside it (md+): the fields' own grid
              overflows a few px into it, which otherwise covered part of
              their buttons. Not on phones, where the map is below instead:
              the stacking context would trap a field's own full-screen map
              under the page's action bar. */}
          <Grid size={{ xs: 12, md: 'auto' }} sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, position: { md: 'relative' }, zIndex: { md: 1 } }}>
            {/* The empty ones behind Add coordinates. */}
            <CoordinateFieldList fieldProps={{ mapBelowOnPhones: true }} items={caveCoordinateItems(form, setForm, t)} />
          </Grid>
          <Grid size={{ xs: 12, md: 'grow' }}>
            <CoordinatesMapPreview hideOnPhones />
          </Grid>
        </Grid>

        </FormSection>
        <FormSection>

        <Typography {...sectionHeadingProps}>{t('sistemaGroup')}</Typography>

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

        <SourceSelect label={t('source')} helperText={t('sourceHint')} noneLabel={t('none')} sources={sources} value={form.source} onChange={(source) => setForm((f) => ({ ...f, source }))} />

        </FormSection>
        <FormSection>

        <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => withTextChange(f, originalCave, 'description', e.target.value))} minRows={5} resizable labelProps={sectionHeadingProps} />
        {form.description?.trim() && <TextSourceField value={form.textSources?.description} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, description: value } }))} sources={sources} />}

        </FormSection>
        <FormSection>

        <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => withTextChange(f, originalCave, 'direction', e.target.value))} minRows={5} resizable labelProps={sectionHeadingProps} />
        {form.direction?.trim() && <TextSourceField value={form.textSources?.direction} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, direction: value } }))} sources={sources} />}

        </FormSection>
        <FormSection>

        <Typography {...columnHeadingProps}>{t('accessGroup')}</Typography>
        <TextField select label={t('access')} {...field('access')} sx={fitSelectSx([t('access'), t('none'), ...accesses.map((a) => a.name)])} slotProps={{ select: { renderValue: (value) => accesses.find((a) => a.id === value)?.name || '', MenuProps: FIT_SELECT_MENU_PROPS } }}>
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
        <MarkdownField label={t('accessDetails')} value={form.accessDetails} onChange={(e) => setForm((f) => withTextChange(f, originalCave, 'accessDetails', e.target.value))} resizable />
        {form.accessDetails?.trim() && <TextSourceField value={form.textSources?.accessDetails} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, accessDetails: value } }))} sources={sources} />}

        </FormSection>
        <FormSection>

        <Typography {...columnHeadingProps}>{t('accessibilityGroup')}</Typography>
        <TextField select label={t('accessibility')} {...field('accessibility')} sx={fitSelectSx([t('accessibility'), t('none'), ...accessibilities.map((a) => a.name)])} slotProps={{ select: { renderValue: (value) => accessibilities.find((a) => a.id === value)?.name || '', MenuProps: FIT_SELECT_MENU_PROPS } }}>
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
        <MarkdownField label={t('accessibilityDetails')} value={form.accessibilityDetails} onChange={(e) => setForm((f) => withTextChange(f, originalCave, 'accessibilityDetails', e.target.value))} resizable />
        {form.accessibilityDetails?.trim() && <TextSourceField value={form.textSources?.accessibilityDetails} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, accessibilityDetails: value } }))} sources={sources} />}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <BooleanToggleField name="cenoteEntrance" value={form.cenoteEntrance} onChange={(cenoteEntrance) => setForm((f) => ({ ...f, cenoteEntrance }))} />
          <BooleanToggleField name="fees" value={form.fees} onChange={(fees) => setForm((f) => ({ ...f, fees }))} />
          <BooleanToggleField name="facilities" value={form.facilities} onChange={(facilities) => setForm((f) => ({ ...f, facilities }))} />
        </Box>

        </FormSection>
        <FormSection>

        <Typography id="oc-cave-edit-note-title" {...columnHeadingProps}>
          {t('notes')}
        </Typography>
        <TextField fullWidth multiline minRows={2} slotProps={{ htmlInput: { 'aria-labelledby': 'oc-cave-edit-note-title' } }} sx={{ '& textarea': { resize: 'vertical' } }} {...field('note')} />
        </FormSection>
      </Box>

      <StickyActionBar gap={1}>
        {!isNew && isAdmin ? (
          <Button color="error" onClick={(event) => {
            // Focus off the button first: the dialog hides the page (aria-hidden on
            // #root) before taking focus, which the browser blocks.
            event.currentTarget.blur()
            setDeleteDialogOpen(true)
          }} disabled={saving} sx={{ mr: 'auto' }}>
            {t('delete')}
          </Button>
        ) : (
          <Box sx={{ mr: 'auto' }} />
        )}
        {/* As in the map pane's form: Save while there are changes (Cancel
            beside it drops them), Exit when there's nothing to save. */}
        {isDirty && (
          <Button onClick={() => navigate(isNew ? '/caves' : `/caves/${caveId}`)} disabled={saving}>
            {t('cancel')}
          </Button>
        )}
        {isDirty ? (
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
            {t('save')}
          </Button>
        ) : (
          <Button variant="contained" onClick={() => navigate(isNew ? '/caves' : `/caves/${caveId}`)} disabled={saving}>
            {t('exit')}
          </Button>
        )}
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
      {/* Its galleries (photos, its system's maps), over the form, which stays. */}
      <Outlet context={{ sistemaId: form.sistemaId }} />
      {unsavedChangesDialog}
    </div>
  )
}
