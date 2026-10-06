import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'

const sourcesModel = createCollectionModel('sources')
const emptyForm = { name: '', description: '', note: '' }

// Creates a `sources` record in place, so a form with a source picker doesn't
// have to send the editor off to /sources and back. `initialName` prefills the
// name; `onCreated(id)` gets the new record's id once it's saved.
export default function NewSourceDialog({ open, initialName = '', onClose, onCreated }) {
  const { t } = useTranslation('newSourceDialog')
  const settleWrite = useSettleWrite()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function field(name) {
    return {
      value: form[name],
      onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const id = pushId()
      // Blank optional fields become undefined, which the model drops.
      // Offline, kept on the device and synced later (useSettleWrite).
      await settleWrite(
        sourcesModel.save(id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
        { name: form.name.trim() },
      )
      onCreated(id)
    } catch (cause) {
      console.error(cause)
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      className="oc-new-source-dialog"
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        transition: {
          // Reset on every open, so a cancelled draft doesn't come back.
          onEnter: () => {
            setForm({ ...emptyForm, name: initialName })
            setError(null)
          },
        },
      }}
    >
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label={t('name')} required autoFocus fullWidth {...field('name')} />
          <MarkdownField label={t('description')} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} resizable />
          <TextField label={t('note')} fullWidth multiline minRows={2} sx={{ '& textarea': { resize: 'vertical' } }} {...field('note')} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
