import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, ListSubheader, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { deleteField } from 'firebase/firestore'
import { orDelete } from '@/utils/firestoreFields.js'
import { clearCurrentCave } from '@/redux/slices/mapSlice.jsx'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import SharedMarkdownField from '@/components/Markdown/MarkdownField.jsx'
import RepeatableTextField from '@/components/RepeatableTextField.jsx'
import NameTranslationsField from '@/components/NameTranslationsField.jsx'
import { num, pickDescription, squaredDistance } from '@/services/data-service/types.js'
import { toContentLanguage } from '@/utils/lang.js'
import { DEFAULT_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'
import CoordinateFieldList, { caveCoordinateItems, caveCoordinatesInRange } from './CoordinateFieldList.jsx'
import BooleanToggleField from './BooleanToggleField.jsx'
import CaveMediaTabs from './CaveMediaTabs.jsx'
import { SISTEMA_DEFAULT_COLOR, COORDINATE_DECIMALS } from '@/config/map.js'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.jsx'
import { ResultPaneSmContext } from './ResultPaneSmContext.js'
import { RESULT_PANE_SM_HEAD_HEIGHT } from '@/config/resultPane.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import SourceSelect from '@/components/SourceSelect.jsx'
import { matchesId } from '@/utils/matchesId.js'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { CAVE_TEXT_FIELDS, textSourcesOf, textSourcesUpdate, withTextChange } from '@/utils/textSources.js'
import TextSourceField from '@/components/TextSourceField.jsx'
import { FIT_SELECT_MENU_PROPS, fitSelectSx } from '@/utils/fitSelect.js'

const areasModel = createCollectionModel('areas')
const sourcesModel = createCollectionModel('sources')
const accessesModel = createCollectionModel('accesses')
const accessibilitiesModel = createCollectionModel('accessibilities')
const languagesModel = createCollectionModel('languages')

/**
 * The shared MarkdownField, with the edit form's placeholder.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.value]
 * @param {(event: {target: {value: string}}) => void} props.onChange
 * @param {number} [props.minRows]
 * @param {boolean} [props.resizable]
 */
function MarkdownField({ label, value, onChange, minRows, resizable }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  return <SharedMarkdownField label={label} value={value} onChange={onChange} minRows={minRows} resizable={resizable} placeholder={t('emptyPreview')} />
}

/**
 * Lighter-weight companion to routes/caves/CaveEdit.jsx: the same map/pane
 * layout as the read-only view (CurrentCaveDetailsContent), swapped for
 * editable fields, for quick in-context tweaks without leaving the map.
 * Covers the fields an editor is likely to touch often; the full field set
 * (aka, rating, reporter, note, exploration date, cover image) stays in the
 * dedicated admin form.
 */
export default function CurrentCaveDetailsContentEdit({ cave }) {
  const { t, i18n } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const settleWrite = useSettleWrite()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isSmall = useSmall()
  // The map's "place on map" mode takes over the screen: no Save bar then.
  const placingOnMap = useSelector((/** @type {RootState} */ state) => !!state.map.placeOnMap)
  const isAdmin = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('admin')
  // descriptions[].lang is a 3-letter code (matching the languages
  // collection / cave nameTranslations), not i18next's own 2-letter code.
  const descriptionLang = toContentLanguage(i18n.resolvedLanguage) || DEFAULT_CONTENT_LANGUAGE
  // Sorts the Sistema dropdown nearest-first, live as the map is panned.
  const mapCenter = useSelector((/** @type {RootState} */ state) => state.map.viewState)

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

    const normalized = Number(num(value, COORDINATE_DECIMALS))
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
    textSources: textSourcesOf(cave, CAVE_TEXT_FIELDS),
    cenoteEntrance: !!cave.cenoteEntrance,
    fees: !!cave.fees,
    facilities: !!cave.facilities,
    longitude: normalizeCoordinateValue(cave.location?.longitude ?? ''),
    latitude: normalizeCoordinateValue(cave.location?.latitude ?? ''),
    parkingLongitude: normalizeCoordinateValue(cave.parking?.longitude ?? ''),
    parkingLatitude: normalizeCoordinateValue(cave.parking?.latitude ?? ''),
    entranceLongitude: normalizeCoordinateValue(cave.entrance?.longitude ?? ''),
    entranceLatitude: normalizeCoordinateValue(cave.entrance?.latitude ?? ''),
    keyLongitude: normalizeCoordinateValue(cave.keys?.[0]?.longitude ?? ''),
    keyLatitude: normalizeCoordinateValue(cave.keys?.[0]?.latitude ?? ''),
    // Each coordinate's validity (valid / unknown / invalid): one without it is unconfirmed.
    locationValidity: cave.location?.validity || 'unknown',
    parkingValidity: cave.parking?.validity || 'unknown',
    entranceValidity: cave.entrance?.validity || 'unknown',
    keyValidity: cave.keys?.[0]?.validity || 'unknown',
    nameTranslations: Object.entries(cave.nameTranslations || {}).map(([lang, values]) => ({
      lang,
      value: (values || []).join(', '),
    })),
  }))
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Phone sheet: once the Name field has scrolled up behind the sheet's head
  // bar, the bar shows the cave's name - as the read-only view does with its
  // title (CurrentCaveDetailsHeader) - and hides it again once it's back.
  const paneData = useContext(ResultPaneSmContext)
  const nameFieldRef = useRef(null)
  useEffect(() => {
    const setTitleHidden = paneData?.setTitleHidden
    if (!setTitleHidden || !nameFieldRef.current) return undefined
    const observer = new IntersectionObserver(([entry]) => setTitleHidden(!entry.isIntersecting), { rootMargin: `-${RESULT_PANE_SM_HEAD_HEIGHT}px 0px 0px 0px` })
    observer.observe(nameFieldRef.current)
    return () => {
      observer.disconnect()
      setTitleHidden(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneData?.setTitleHidden])
  const { isDirty, setBaseline, discardChanges, unsavedChangesDialog } = useUnsavedChanges(form, { initial: form, onSave: handleSave, canSave: !!form.name && caveCoordinatesInRange(form) })
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

  // leaving: saving from the unsaved-changes dialog, which then goes on to
  // wherever the user was headed instead.
  async function handleSave({ leaving = false } = {}) {
    const savedForm = form
    setSaving(true)
    try {
      const trimmedAka = form.aka.map((s) => s.trim()).filter(Boolean)

      const fields = {
        // The texts' sources the form changed (textSources).
        textSources: textSourcesUpdate(cave, form, CAVE_TEXT_FIELDS),
        name: { value: form.name },
        aka: orDelete(trimmedAka),
        videos: form.videos.map((url) => url.trim()).filter(Boolean),
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
      }

      if (form.longitude === '' && form.latitude === '' && cave.location) {
        fields.location = deleteField()
      } else if (form.longitude !== '' && form.latitude !== '') {
        fields.location = { longitude: Number(num(form.longitude, COORDINATE_DECIMALS)), latitude: Number(num(form.latitude, COORDINATE_DECIMALS)), validity: form.locationValidity }
      }

      if (form.parkingLongitude === '' && form.parkingLatitude === '' && cave.parking) {
        fields.parking = deleteField()
      } else if (form.parkingLongitude !== '' && form.parkingLatitude !== '') {
        fields.parking = { longitude: Number(num(form.parkingLongitude, COORDINATE_DECIMALS)), latitude: Number(num(form.parkingLatitude, COORDINATE_DECIMALS)), validity: form.parkingValidity }
      }

      if (form.entranceLongitude === '' && form.entranceLatitude === '' && cave.entrance) {
        fields.entrance = deleteField()
      } else if (form.entranceLongitude !== '' && form.entranceLatitude !== '') {
        fields.entrance = { longitude: Number(num(form.entranceLongitude, COORDINATE_DECIMALS)), latitude: Number(num(form.entranceLatitude, COORDINATE_DECIMALS)), validity: form.entranceValidity }
      }

      if (form.keyLongitude === '' && form.keyLatitude === '' && cave.keys?.length) {
        fields.keys = deleteField()
      } else if (form.keyLongitude !== '' && form.keyLatitude !== '') {
        fields.keys = [{ longitude: Number(num(form.keyLongitude, COORDINATE_DECIMALS)), latitude: Number(num(form.keyLatitude, COORDINATE_DECIMALS)), validity: form.keyValidity }]
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

      // Offline, kept on the device and synced later (useSettleWrite says so).
      const status = await settleWrite(CaveModel.save(cave.id, fields), { name: t('caveTitle', { name: form.name || cave.name?.value || cave.id }) })
      setBaseline(savedForm)
      const refresh = async () => {
        invalidateData()
        await getData()
      }
      if (status === 'saved') {
        await refresh()
        openSnackbar(tApp('snackbar.saved', { name: t('caveTitle', { name: form.name || cave.name?.value || cave.id }) }), { severity: 'success' })
      } else refresh().catch((error) => console.warn(error))
    } catch (error) {
      // Nothing saved: say so, and leave the form as it is (still changed).
      console.error(error)
      openSnackbar(tApp('snackbar.saveError', { name: t('caveTitle', { name: form.name || cave.name?.value || cave.id }) }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteDialogOpen(false)
    setSaving(true)
    try {
      await CaveModel.remove(cave.id)
      discardChanges()
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
          ? (theme) => ({ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: theme.zIndex.appBar, bgcolor: 'var(--oc-result-pane-surface-color, var(--mui-palette-background-paper))', borderTop: '1px solid', borderColor: 'divider', px: 'var(--oc-pane-padding-inline)', pt: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))' })
          : // A bar across the whole pane, to its bottom edge (over the form's
            // padding): MD3's bottom app bar surface, a divider over it.
            (theme) => ({ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, position: 'sticky', bottom: 0, zIndex: 1, mt: 1, mx: 'calc(-1 * var(--oc-pane-padding-inline))', mb: 'calc(-1 * var(--oc-pane-padding-inline))', px: 'var(--oc-pane-padding-inline)', py: 1.5, bgcolor: theme.vars.sys.color.surfaceContainer, borderTop: '1px solid', borderColor: 'divider' })
      }
    >
      {/* Deleting a cave is for admins (firestore.rules). */}
      {isAdmin ? (
        <Button color="error" onClick={(event) => {
            // Focus off the button first: the dialog hides the page (aria-hidden on
            // #root) before taking focus, which the browser blocks.
            event.currentTarget.blur()
            setDeleteDialogOpen(true)
          }} disabled={saving} sx={{ mr: 'auto', minWidth: 88 }}>
          {t('delete')}
        </Button>
      ) : (
        <Box sx={{ mr: 'auto' }} />
      )}
      {/* Saving stays in edit mode; with nothing (left) to save, the main
          button leaves it - Cancel only while there are changes to drop. */}
      {isDirty && (
        <Button onClick={exitEditMode} disabled={saving} sx={{ minWidth: 88 }}>
          {t('cancel')}
        </Button>
      )}
      {isDirty ? (
        <Button variant="contained" onClick={() => handleSave()} disabled={saving || !form.name || !caveCoordinatesInRange(form)} sx={{ minWidth: 88 }}>
          {t('save')}
        </Button>
      ) : (
        <Button variant="contained" onClick={exitEditMode} disabled={saving} sx={{ minWidth: 88 }}>
          {t('exit')}
        </Button>
      )}
    </Box>
  )

  // M3 touch sizing for the whole form on phones (it's built from dense,
  // desktop-sized controls shared with the admin pages): 40dp-tall buttons,
  // standard-size switches. Icon buttons get their 48dp touch target from
  // the theme (MuiIconButton).
  const phoneTouchSizing = {
    '& .MuiButton-root': { minHeight: 40 },
  }

  return (
    <Box className="oc-current-cave-details-content-edit oc-result-pane--content" sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 'var(--oc-pane-padding-inline)', ...(isSmall && { pb: 'calc(var(--oc-pane-padding-inline) + 72px + env(safe-area-inset-bottom))', ...phoneTouchSizing }) }}>
      {/* Its header: which cave is edited, and a way back to it (only Exit,
          at the bottom, led out). The saved name, while the field changes. */}
      <Box className="oc-current-cave-details-content-edit--header" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: -1.5, mt: -1 }}>
        <Tooltip title={tApp('back')}>
          <IconButton aria-label={tApp('back')} onClick={exitEditMode} disabled={saving}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h6" noWrap sx={{ minWidth: 0 }}>
          {tApp('editTitle', { title: t('caveTitle', { name: cave.name?.value || form.name || cave.id }) })}
        </Typography>
      </Box>

      <TextField ref={nameFieldRef} label={t('name')} fullWidth required {...field('name')} />

      <RepeatableTextField label={t('aka')} values={form.aka} onChange={(aka) => setForm((f) => ({ ...f, aka }))} addLabel={t('addAka')} removeLabel={t('removeAka')} />

      <NameTranslationsField label={t('nameTranslations')} rows={form.nameTranslations} languages={languages} onChange={(nameTranslations) => setForm((f) => ({ ...f, nameTranslations }))} addLabel={t('addNameTranslation')} removeLabel={t('removeNameTranslation')} languageLabel={t('nameTranslationLanguage')} valueLabel={t('nameTranslationValue')} />

      <Divider />

      <CaveMediaTabs caveId={cave.id} videos={form.videos} onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))} sistemaId={form.sistemaId} />

      <Divider />

      <Typography variant="subtitle2" component="h2">{t('coordinates')}</Typography>

      {/* The empty ones behind Add coordinates. */}
      <CoordinateFieldList items={caveCoordinateItems(form, setForm, t)} />

      <Divider />

      <Typography variant="subtitle2" component="h2">{t('sistemaGroup')}</Typography>
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
            return s.id === form.sistemaId || !q || (s.name || s.id).toLowerCase().includes(q) || (areasById.get(s.area) || '').toLowerCase().includes(q) || matchesId(s.id, q)
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

      <SourceSelect label={t('source')} helperText={t('sourceHint')} noneLabel={t('none')} sources={sources} value={form.source} onChange={(source) => setForm((f) => ({ ...f, source }))} />

      <MarkdownField label={t('description')} value={form.description} onChange={(e) => setForm((f) => withTextChange(f, cave, 'description', e.target.value))} minRows={5} resizable />
      {form.description?.trim() && <TextSourceField value={form.textSources?.description} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, description: value } }))} sources={sources} />}
      <MarkdownField label={t('direction')} value={form.direction} onChange={(e) => setForm((f) => withTextChange(f, cave, 'direction', e.target.value))} minRows={5} resizable />
      {form.direction?.trim() && <TextSourceField value={form.textSources?.direction} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, direction: value } }))} sources={sources} />}

      <Divider />

      <Typography variant="subtitle2" component="h2">{t('accessGroup')}</Typography>
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
      <MarkdownField label={t('accessDetails')} value={form.accessDetails} onChange={(e) => setForm((f) => withTextChange(f, cave, 'accessDetails', e.target.value))} resizable />
      {form.accessDetails?.trim() && <TextSourceField value={form.textSources?.accessDetails} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, accessDetails: value } }))} sources={sources} />}

      <Divider />
      <Typography variant="subtitle2" component="h2">{t('accessibilityGroup')}</Typography>
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
      <MarkdownField label={t('accessibilityDetails')} value={form.accessibilityDetails} onChange={(e) => setForm((f) => withTextChange(f, cave, 'accessibilityDetails', e.target.value))} resizable />
      {form.accessibilityDetails?.trim() && <TextSourceField value={form.textSources?.accessibilityDetails} onChange={(value) => setForm((f) => ({ ...f, textSources: { ...f.textSources, accessibilityDetails: value } }))} sources={sources} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <BooleanToggleField name="cenoteEntrance" value={form.cenoteEntrance} onChange={(cenoteEntrance) => setForm((f) => ({ ...f, cenoteEntrance }))} />
        <BooleanToggleField name="fees" value={form.fees} onChange={(fees) => setForm((f) => ({ ...f, fees }))} />
        <BooleanToggleField name="facilities" value={form.facilities} onChange={(facilities) => setForm((f) => ({ ...f, facilities }))} />
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
      {unsavedChangesDialog}
    </Box>
  )
}
