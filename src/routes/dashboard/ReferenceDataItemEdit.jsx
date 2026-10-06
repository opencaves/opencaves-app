import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.jsx'
import { toContentLanguage } from '@/utils/lang.js'
import { DEFAULT_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import ColorPicker from '@/components/ColorPicker/ColorPicker.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'
import EditPageHeader from '@/components/EditPageHeader.jsx'
import FormSkeleton from '@/components/Skeletons/FormSkeleton.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import { slugify } from '@/utils/slug.js'

const emptyFields = (fields) => Object.fromEntries(fields.map((f) => [f, '']))

// An area's address names it by its slug (/areas/<slug>/edit, as its public
// page /areas/<slug>), older links by its record id: the record's id, null
// while the areas aren't known yet. Other collections' addresses are ids.
// The areas come from the app's data once loaded; before that (a first
// visit), from the small areas collection itself, rather than waiting for
// the whole cave data to load.
function useItemId(collectionName, param) {
  const storeAreas = useSelector((state) => state.data.areas)
  const needsAreas = collectionName === 'areas' && param !== 'new'
  const [fetchedAreas, setFetchedAreas] = useState(null)
  useEffect(() => {
    if (!needsAreas || storeAreas.length > 0) return undefined
    let cancelled = false
    createCollectionModel('areas')
      .getAll()
      .then((areas) => !cancelled && setFetchedAreas(areas))
    return () => {
      cancelled = true
    }
  }, [needsAreas, storeAreas.length])
  if (!needsAreas) return param
  const areas = storeAreas.length > 0 ? storeAreas : fetchedAreas
  if (!areas) return null
  if (areas.some((area) => area.id === param)) return param
  return areas.find((area) => slugify(area.name || area.id) === param)?.id ?? param
}

export default function ReferenceDataItemEdit() {
  const params = useParams()
  const location = useLocation()
  const collectionName = params.collectionName || location.pathname.split('/').filter(Boolean)[0]
  const itemId = useItemId(collectionName, params.itemId)
  const config = REFERENCE_DATA_CONFIGS[collectionName]
  const { setTitle } = useTitle()
  const { t, i18n } = useTranslation('dashboard')
  const { t: tApp } = useTranslation('app')
  const [openSnackbar] = useSnackbar()
  const navigate = useNavigate()
  // descriptions[].lang is stored as a 3-letter code (matching the
  // `languages` collection / cave nameTranslations), not i18next's own
  // 2-letter language code.
  const lang = toContentLanguage(i18n.resolvedLanguage) || DEFAULT_CONTENT_LANGUAGE
  const isNew = itemId === 'new'
  const isArea = collectionName === 'areas'

  const [model] = useState(() => createCollectionModel(collectionName))
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [form, setForm] = useState(emptyFields(config?.fields || []))
  const [saving, setSaving] = useState(false)
  // A new item's baseline is its empty form; an existing one's is set once loaded.
  const { isDirty, setBaseline, unsavedChangesDialog } = useUnsavedChanges(form, { initial: isNew ? form : undefined, onSave: handleSave })

  // Every edit page's title says so: "Edit <the item's name>" (its id field -
  // name, code or hex - once loaded, else the collection's name); a new item
  // stays "New …".
  const itemLabel = config ? form[config.id?.from || 'name'] || form.name || form.code || form.hex : ''
  useEffect(() => {
    if (!config) {
      setTitle(collectionName)
    } else if (isNew) {
      setTitle(t(`collections.${collectionName}.newItem`))
    } else {
      setTitle(tApp('editTitle', { title: itemLabel || t(`collections.${collectionName}.title`) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, isNew, t, tApp, itemLabel])

  useEffect(() => {
    if (isNew || !config || !itemId) {
      return
    }

    let cancelled = false
    setLoading(true)
    model.getById(itemId).then((loadedItem) => {
      if (cancelled) {
        return
      }
      setItem(loadedItem)
      const loaded = Object.fromEntries(config.fields.map((f) => [f, f === config.descriptionsField ? pickDescription(loadedItem?.descriptions, lang) : loadedItem?.[f] || '']))
      setForm(loaded)
      setBaseline(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, itemId])

  // Falls back to the raw field key for fields without a translated label yet.
  const fieldLabel = (field) => t(`fieldLabels.${field}`, { defaultValue: field })

  function goBack() {
    // Replace, not push: otherwise the edit URL stays in history as its own
    // entry, and the browser Back button from the list (after Cancel/Save)
    // would land right back on it instead of skipping past it. An area goes
    // back to its public page (its name can't change once created).
    const areaSlug = isArea && !isNew ? slugify(form.name || itemId) : ''
    navigate(areaSlug ? `/areas/${areaSlug}` : `/${collectionName}`, { replace: true })
  }

  if (!config) {
    return (
      <Typography className="oc-reference-data-item-edit" color="error">
        Unknown reference collection: {collectionName}
      </Typography>
    )
  }

  // leaving: saving from the unsaved-changes dialog, which then goes on to
  // wherever the user was headed instead.
  async function handleSave({ leaving = false } = {}) {
    const savedForm = form
    setSaving(true)
    try {
      const id = isNew ? (config.id.kind === 'generated' ? pushId() : config.id.transform(form[config.id.from])) : itemId

      const fields = { ...form }
      if (config.descriptionsField) {
        const description = fields[config.descriptionsField]
        delete fields[config.descriptionsField]
        const otherDescriptions = (item?.descriptions || []).filter((d) => d.lang !== lang)
        fields.descriptions = description ? [...otherDescriptions, { lang, description }] : otherDescriptions
      }

      await model.save(id, fields)
      setBaseline(savedForm)
      invalidateData()
      await getData()
      // Stays on the form after saving. A new item only gets its id here, so
      // the URL switches to it (replace, no new history entry), which also
      // reloads it; an existing item just refreshes the baseline its
      // descriptions are merged against.
      if (isNew && !leaving) navigate(`/${collectionName}/${isArea ? slugify(form.name) || id : id}/edit`, { replace: true })
      else setItem((current) => ({ ...current, ...fields }))
      openSnackbar(tApp('snackbar.saved', { name: itemLabel || t(`collections.${collectionName}.title`) }), { severity: 'success' })
    } catch (error) {
      // Nothing saved: say so, and leave the form as it is (still changed).
      console.error(error)
      openSnackbar(tApp('snackbar.saveError', { name: itemLabel || t(`collections.${collectionName}.title`) }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="oc-reference-data-item-edit">
      <EditPageHeader>
        <IconButton onClick={goBack} aria-label={t('back')} sx={{ ml: { xs: 0, sm: -5 } }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5" data-appbar-page-title>
          {t(`collections.${collectionName}.${isNew ? 'newItem' : 'title'}`)}
        </Typography>
      </EditPageHeader>

      {loading ? (
        <FormSkeleton header={false} fill={false} actions="inside" sections={[{ fields: config.fields.map((field) => (field === 'note' ? { width: '100%', height: 80 } : field === 'description' ? { kind: 'markdown' } : '100%')) }]} sx={{ maxWidth: 480 }} />
      ) : (
        <Box sx={{ ...DASHBOARD_SURFACE_SX, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480, p: { xs: 2, sm: 3 } }}>
          {config.fields.map((field) => {
            if (field === 'description') {
              return <MarkdownField key={field} label={fieldLabel(field)} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} resizable />
            }
            if ((collectionName === 'colors' && field === 'hex') || field === 'color') {
              return <ColorPicker key={field} label={t('color', { defaultValue: 'Color' })} value={form[field]} onChange={(hex) => setForm((f) => ({ ...f, [field]: hex }))} saveOnAdd={false} />
            }
            return <TextField key={field} label={field === 'note' ? t('notesLabel') : fieldLabel(field)} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} disabled={!isNew && field === config.id.from} multiline={field === 'note'} minRows={field === 'note' ? 2 : undefined} sx={field === 'note' ? { '& textarea': { resize: 'vertical' } } : undefined} />
          })}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={goBack} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button variant="contained" onClick={() => handleSave()} disabled={saving || !isDirty}>
              {t('save')}
            </Button>
          </Box>
        </Box>
      )}
      {unsavedChangesDialog}
    </div>
  )
}
