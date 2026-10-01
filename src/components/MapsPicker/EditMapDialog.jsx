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
import { useSmall } from '@/hooks/useSmall.jsx'

const mapsModel = createCollectionModel('maps')
const PREVIEW_SIZE = 440
const emptyDetails = { title: '', date: '', authors: [], note: '' }

// Editing a map's title/date/authors, shared by every place a map can be
// edited from (the cave pane's Maps tab, and the map viewer's menu) so the
// form and its save logic exist in exactly one place.
export default function EditMapDialog({ map, onClose }) {
  const { t } = useTranslation('mapsPicker')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [details, setDetails] = useState(emptyDetails)
  const [saving, setSaving] = useState(false)
  const isSmall = useSmall()

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

  // Phones: full screen, the preview above the form at the screen's width,
  // and no dragging (nothing to move a full-screen dialog to, and it would
  // fight scrolling). The preview's size also drives its zoom limits.
  const previewSize = isSmall ? Math.min(window.innerWidth - 48, PREVIEW_SIZE) : PREVIEW_SIZE

  return (
    <Dialog className="oc-edit-map-dialog" open={!!map} onClose={onClose} maxWidth={false} fullScreen={isSmall} PaperComponent={isSmall ? undefined : DraggableDialogPaper}>
      <DialogTitle noWrap className={isSmall ? undefined : 'oc-draggable-dialog--handle'} sx={{ cursor: isSmall ? undefined : 'move' }}>
        {tEdit('editMap')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: isSmall ? 'auto' : 900 }}>
        <Box sx={{ display: 'flex', flexDirection: isSmall ? 'column' : 'row', gap: isSmall ? 2 : 1.5, pt: isSmall ? 1 : 0 }}>
          <Box sx={{ width: previewSize, height: previewSize, flexShrink: 0, alignSelf: 'center' }}>
            <PendingFilePreview existingUrl={map?.previewUrl || map?.url} existingContentType={map?.previewUrl ? undefined : map?.contentType} width={previewSize} height={previewSize} />
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
