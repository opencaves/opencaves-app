import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
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

// The details as they would be saved: spaces trimmed, blank authors dropped -
// what tells a real change from an untouched form.
function saved({ title, date, authors, note }) {
  return JSON.stringify({ title: title.trim(), date: date || '', authors: authors.map((a) => a.trim()).filter(Boolean), note: note.trim() })
}

// Editing a map's title/date/authors, shared by every place a map can be
// edited from (the cave pane's Maps tab, and the map viewer's menu) so the
// form and its save logic exist in exactly one place.
export default function EditMapDialog({ map, onClose }) {
  const { t } = useTranslation('mapsPicker')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [details, setDetails] = useState(emptyDetails)
  const [saving, setSaving] = useState(false)
  const isSmall = useSmall()

  const initial = useMemo(() => (map ? { title: map.name || '', date: map.date || '', authors: map.authors || [], note: map.note || '' } : emptyDetails), [map])
  useEffect(() => {
    if (map) setDetails(initial)
  }, [map, initial])
  // Save is enabled only once something would actually change.
  const changed = saved(details) !== saved(initial)

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
      <DialogTitle noWrap className={isSmall ? undefined : 'oc-draggable-dialog--handle'} sx={{ cursor: isSmall ? undefined : 'move', pr: 7 }}>
        {tEdit('editMap')}
      </DialogTitle>
      {/* Outside the title: the title is the drag handle. */}
      <Tooltip title={t('close')}>
        <IconButton className="oc-edit-map-dialog--close" aria-label={t('close')} onClick={onClose} disabled={saving} sx={{ position: 'absolute', top: 12, right: 12 }}>
          <CloseRounded />
        </IconButton>
      </Tooltip>
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
        <Button variant="contained" onClick={confirmEdit} disabled={saving || !changed || !details.title.trim()} startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          {tEdit('save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
