import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import DraggableDialogPaper from '@/components/DraggableDialogPaper.jsx'
import AuthorsField from './AuthorsField.jsx'
import MapSistemaField from './MapSistemaField.jsx'
import PendingFilePreview from './PendingFilePreview.jsx'
import PartialDateField from '@/components/PartialDateField.jsx'

const mapsModel = createCollectionModel('maps')
const emptyDetails = { title: '', date: '', authors: [], note: '' }

// Editing a map's title/date/authors, shared by every place a map can be
// edited from (the cave pane's Maps tab, and the map viewer's menu) so the
// form and its save logic exist in exactly one place.
export default function EditMapDialog({ map, onClose }) {
  const { t } = useTranslation('mapsPicker')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [details, setDetails] = useState(emptyDetails)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (map) {
      setDetails({ title: map.name || '', date: map.date || '', authors: map.authors || [], note: map.note || '' })
    }
  }, [map])

  async function confirmEdit() {
    setSaving(true)
    try {
      const trimmedAuthors = details.authors.map((author) => author.trim()).filter(Boolean)
      // Unlike a new upload, editing may need to clear a field that was
      // previously set - save()'s merge:true leaves omitted/undefined
      // fields untouched, so an explicit deleteField() sentinel is needed
      // here instead of just leaving them out.
      await mapsModel.save(map.id, {
        name: details.title.trim(),
        date: details.date || deleteField(),
        authors: trimmedAuthors.length > 0 ? trimmedAuthors : deleteField(),
        note: details.note.trim() || deleteField(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog className="oc-edit-map-dialog" open={!!map} onClose={onClose} maxWidth={false} PaperComponent={DraggableDialogPaper}>
      <DialogTitle noWrap className="oc-draggable-dialog--handle" sx={{ cursor: 'move' }}>
        {tEdit('editMap')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 900 }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ width: 440, height: 440, flexShrink: 0 }}>
            <PendingFilePreview existingUrl={map?.previewUrl || map?.url} existingContentType={map?.previewUrl ? undefined : map?.contentType} width={440} height={440} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <MapSistemaField autoFocus value={details.title} onChange={(title) => setDetails((d) => ({ ...d, title }))} />
            <PartialDateField size="small" label={t('mapDate')} description={t('mapDateHint')} fullWidth value={details.date} onChange={(e) => setDetails((d) => ({ ...d, date: e.target.value }))} />
            <AuthorsField value={details.authors} onChange={(authors) => setDetails((d) => ({ ...d, authors }))} />
            <TextField size="small" label={t('mapNote')} fullWidth multiline minRows={2} value={details.note} onChange={(e) => setDetails((d) => ({ ...d, note: e.target.value }))} sx={{ '& textarea': { resize: 'vertical' } }} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={confirmEdit} disabled={saving || !details.title.trim()} startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          {tEdit('save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
