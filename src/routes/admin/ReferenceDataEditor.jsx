import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Button, IconButton, List, ListItem, ListItemText, TextField, Typography } from '@mui/material'
import { Delete, Edit } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { dashedId, pickDescription } from '@/services/data-service/types.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

// Per-collection shape: which fields the form shows, and how the document ID
// is derived (a slug of one of the fields, the record's own value for one of
// its fields, or an opaque generated ID when nothing suitable exists).
// `descriptionsField` marks a field that is actually backed by a
// `descriptions: [{ lang, description }]` array (only English is ever
// populated from the Google Sheet) - this form edits the entry for the
// admin's current UI language, leaving other languages untouched.
const CONFIGS = {
  accesses: { label: 'Accesses', fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  accessibilities: { label: 'Accessibilities', fields: ['name', 'description', 'note'], descriptionsField: 'description', id: { from: 'name', transform: dashedId } },
  sources: { label: 'Sources', fields: ['name', 'description', 'note'], id: { kind: 'generated' } },
  areas: { label: 'Areas', fields: ['name', 'note'], id: { from: 'name', transform: (v) => v } },
  colors: { label: 'Colors', fields: ['hex'], id: { kind: 'generated' } },
  languages: { label: 'Languages', fields: ['code', 'eng', 'fra'], id: { from: 'code', transform: (v) => v } },
}

const emptyFields = (fields) => Object.fromEntries(fields.map((f) => [f, '']))

export default function ReferenceDataEditor() {
  const { collectionName } = useParams()
  const config = CONFIGS[collectionName]
  const { setTitle } = useTitle()
  const { i18n } = useTranslation()

  const [model] = useState(() => createCollectionModel(collectionName))
  const [items, loading] = model.useAll()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyFields(config?.fields || []))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(config?.label || collectionName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName])

  if (!config) {
    return <Typography color="error">Unknown reference collection: {collectionName}</Typography>
  }

  function startNew() {
    setEditingId('new')
    setForm(emptyFields(config.fields))
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm(Object.fromEntries(config.fields.map((f) => [f, f === config.descriptionsField ? pickDescription(item.descriptions, i18n.language) : item[f] || ''])))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyFields(config.fields))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const id = editingId !== 'new' ? editingId : config.id.kind === 'generated' ? pushId() : config.id.transform(form[config.id.from])

      const fields = { ...form }
      if (config.descriptionsField) {
        const description = fields[config.descriptionsField]
        delete fields[config.descriptionsField]
        const existingItem = editingId !== 'new' ? items.find((i) => i.id === editingId) : undefined
        const otherDescriptions = (existingItem?.descriptions || []).filter((d) => d.lang !== i18n.language)
        fields.descriptions = description ? [...otherDescriptions, { lang: i18n.language, description }] : otherDescriptions
      }

      await model.save(id, fields)
      invalidateData()
      await getData()
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this item?')) {
      return
    }
    await model.remove(id)
    invalidateData()
    await getData()
  }

  return (
    <div>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
        {config.label}
      </Typography>

      {editingId ? (
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
          {config.fields.map((field) => (
            <TextField key={field} label={field} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} disabled={editingId !== 'new' && field === config.id.from} multiline={field === 'description' || field === 'note'} minRows={field === 'description' || field === 'note' ? 2 : undefined} />
          ))}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              Save
            </Button>
            <Button onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <Button variant="contained" sx={{ mb: 2 }} onClick={startNew}>
          New
        </Button>
      )}

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem
              key={item.id}
              divider
              secondaryAction={
                <>
                  <IconButton edge="end" onClick={() => startEdit(item)} aria-label="Edit">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDelete(item.id)} aria-label="Delete">
                    <Delete fontSize="small" />
                  </IconButton>
                </>
              }
            >
              <ListItemText primary={item.name || item.hex || item.code || item.id} secondary={item.id} />
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}
