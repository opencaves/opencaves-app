import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import { ArrowBackRounded } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { ISO6391ToISO6392 } from '@/utils/lang.jsx'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import { REFERENCE_DATA_CONFIGS } from './referenceDataConfigs.js'

const emptyFields = (fields) => Object.fromEntries(fields.map((f) => [f, '']))

export default function ReferenceDataItemEdit() {
  const { collectionName, itemId } = useParams()
  const config = REFERENCE_DATA_CONFIGS[collectionName]
  const { setTitle } = useTitle()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  // descriptions[].lang is stored as a 3-letter code (matching the
  // `languages` collection / cave nameTranslations), not i18next's own
  // 2-letter language code.
  const lang = ISO6391ToISO6392(i18n.resolvedLanguage) || 'eng'
  const isNew = itemId === 'new'

  const [model] = useState(() => createCollectionModel(collectionName))
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [form, setForm] = useState(emptyFields(config?.fields || []))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(config?.label || collectionName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName])

  useEffect(() => {
    if (isNew || !config) {
      return
    }

    let cancelled = false
    setLoading(true)
    model.getById(itemId).then((loadedItem) => {
      if (cancelled) {
        return
      }
      setItem(loadedItem)
      setForm(Object.fromEntries(config.fields.map((f) => [f, f === config.descriptionsField ? pickDescription(loadedItem?.descriptions, lang) : loadedItem?.[f] || ''])))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, itemId])

  function goBack() {
    navigate(`/dashboard/${collectionName}`)
  }

  if (!config) {
    return (
      <Typography className="oc-reference-data-item-edit" color="error">
        Unknown reference collection: {collectionName}
      </Typography>
    )
  }

  async function handleSave() {
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
      invalidateData()
      await getData()
      goBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="oc-reference-data-item-edit">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={goBack} aria-label="Back">
          <ArrowBackRounded />
        </IconButton>
        <Typography component="h1" variant="h5">
          {isNew ? `New ${config.label.replace(/s$/, '')}` : config.label}
        </Typography>
      </Box>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
          {config.fields.map((field) => (field === 'description' ? <MarkdownField key={field} label={field} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} /> : <TextField key={field} label={field} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} disabled={!isNew && field === config.id.from} multiline={field === 'note'} minRows={field === 'note' ? 2 : undefined} />))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={goBack} disabled={saving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </Box>
        </Box>
      )}
    </div>
  )
}
