import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteField } from 'firebase/firestore'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import DraggableDialogPaper from '@/components/DraggableDialogPaper.jsx'
import AuthorsField from './AuthorsField.jsx'
import MapSistemaField from './MapSistemaField.jsx'
import PendingFilePreview from './PendingFilePreview.jsx'
import PartialDateField, { isValidPartialDate } from '@/components/PartialDateField.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'

const mapsModel = createCollectionModel('maps')
// The preview fills the window's height, up to this; the form beside it.
const MAX_PREVIEW_SIZE = 720
const FORM_WIDTH = 420
const emptyDetails = { title: '', date: '', authors: [], note: '' }

// Editing a map's title/date/authors, shared by every place a map can be
// edited from (the cave pane's Maps tab, the map viewer's menu, a sistema's
// edit page) so the form and its save logic exist in exactly one place.
// `onRemove`, when given, adds a button to remove the map from where it's
// shown (the map library is shared: the file itself stays), after a
// confirmation.
export default function EditMapDialog({ map, onClose, onRemove }) {
  const { t } = useTranslation('mapsPicker')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [details, setDetails] = useState(emptyDetails)
  const [saving, setSaving] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
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
  const previewSize = isSmall
    ? Math.min(window.innerWidth - 48, MAX_PREVIEW_SIZE)
    : Math.max(440, Math.min(MAX_PREVIEW_SIZE, window.innerHeight - 220, window.innerWidth - FORM_WIDTH - 140))

  return (
    <Dialog className="oc-edit-map-dialog" open={!!map} onClose={onClose} maxWidth={false} fullScreen={isSmall} PaperComponent={isSmall ? undefined : DraggableDialogPaper}>
      <DialogTitle noWrap className={isSmall ? undefined : 'oc-draggable-dialog--handle'} sx={{ cursor: isSmall ? undefined : 'move' }}>
        {tEdit('editMap')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: isSmall ? 'auto' : previewSize + 12 + FORM_WIDTH }}>
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
        {onRemove && (
          <Button className="oc-edit-map-dialog--remove" color="error" onClick={() => setConfirmingRemove(true)} disabled={saving} sx={{ mr: 'auto' }}>
            {t('removeFromSistema')}
          </Button>
        )}
        <Button onClick={onClose} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={confirmEdit} disabled={saving || !details.title.trim() || !isValidPartialDate(details.date)} startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          {tEdit('save')}
        </Button>
      </DialogActions>
      <Dialog className="oc-edit-map-dialog--remove-confirm" open={confirmingRemove} onClose={() => setConfirmingRemove(false)}>
        <DialogTitle>{t('removeConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('removeConfirm', { name: map?.name })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingRemove(false)}>{t('cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmingRemove(false)
              onRemove(map)
              onClose()
            }}
          >
            {t('remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
