import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import AddButton from '@/components/AddButton.jsx'
import PartialDateField from '@/components/PartialDateField.jsx'
import DraggableDialogPaper from '@/components/DraggableDialogPaper.jsx'
import AuthorsField from '@/components/MapsPicker/AuthorsField.jsx'
import MapSistemaField from '@/components/MapsPicker/MapSistemaField.jsx'
import PendingFilePreview from '@/components/MapsPicker/PendingFilePreview.jsx'
import MapUploadFeedback, { useMapUpload } from '@/components/MapsPicker/MapUpload.jsx'
import SistemaModel from '@/models/SistemaModel.js'

const emptyPendingDetails = { title: '', date: '', authors: [], note: '' }

// "Add map" for a cave system (the map sheet's Maps tab, the cave and system
// pages): a file picked, its details asked (title - the system's name to
// start with -, date, authors, note), uploaded and added to the system's
// maps; offline, kept to upload later (useMapUpload) and added then.
// canAdd: editors; the others get onAddUnauthorized (e.g. to log in), or no
// button. A cave without a system can't take a map: the button is disabled,
// saying so. spaced: room above it (after a list of maps).
export default function AddMapButton({ sistemaId, canAdd = true, onAddUnauthorized, spaced = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const { t: tMaps } = useTranslation('mapsPicker')
  const [sistemas] = SistemaModel.useAll()
  const sistema = sistemas.find((s) => s.id === sistemaId)
  const fileInputRef = useRef()
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingDetails, setPendingDetails] = useState(emptyPendingDetails)
  const { uploadMap, uploading, progress, current, error, clearError } = useMapUpload()
  const mapValues = (Array.isArray(sistema?.maps) ? sistema.maps : []).map((value) => value.trim()).filter(Boolean)

  if (!canAdd && !onAddUnauthorized) return null

  function selectFile() {
    clearError()
    fileInputRef.current?.click()
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPendingFile(file)
    setPendingDetails({ ...emptyPendingDetails, title: sistema?.name || '' })
  }

  function cancelPendingUpload() {
    setPendingFile(null)
    setPendingDetails(emptyPendingDetails)
  }

  async function confirmUpload() {
    const trimmedAuthors = pendingDetails.authors.map((author) => author.trim()).filter(Boolean)
    const uploaded = await uploadMap(pendingFile, {
      title: pendingDetails.title.trim(),
      date: pendingDetails.date || undefined,
      authors: trimmedAuthors,
      note: pendingDetails.note.trim() || undefined,
    }, { attachToSistemaId: sistemaId })
    if (!uploaded) return

    // Offline, kept to upload later: it's added to the system then.
    if (!uploaded.pending) await SistemaModel.save(sistemaId, { maps: [...mapValues, uploaded.id] })
    setPendingFile(null)
    setPendingDetails(emptyPendingDetails)
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: spaced ? 2 : 0 }}>
        <AddButton startIcon={uploading ? <CircularProgress size={18} /> : undefined} disabled={uploading || (canAdd && !sistemaId)} onClick={() => (canAdd ? selectFile() : onAddUnauthorized?.())}>
          {t('addMap')}
        </AddButton>
      </Box>
      {canAdd && !sistemaId && (
        // Supporting text for the Add map button above: 8dp from it, and a
        // little extra room (with the form's own gap, 24dp) after it.
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1, mb: 1 }}>
          {t('mapsNeedSistema')}
        </Typography>
      )}
      <input ref={fileInputRef} type="file" hidden accept="image/*,application/pdf" onChange={handleFileSelected} />
      <MapUploadFeedback uploading={uploading} progress={progress} current={current} error={error} clearError={clearError} />

      <Dialog className="oc-add-map-button--dialog" open={!!pendingFile} onClose={cancelPendingUpload} maxWidth={false} PaperComponent={DraggableDialogPaper}>
        <DialogTitle noWrap className="oc-draggable-dialog--handle" sx={{ cursor: 'move' }}>
          {pendingFile?.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 900 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ width: 440, height: 440, flexShrink: 0 }}>
              <PendingFilePreview file={pendingFile} width={440} height={440} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <MapSistemaField autoFocus value={pendingDetails.title} onChange={(title) => setPendingDetails((d) => ({ ...d, title }))} />
              <PartialDateField size="small" label={tMaps('mapDate')} description={tMaps('mapDateHint')} fullWidth value={pendingDetails.date} onChange={(e) => setPendingDetails((d) => ({ ...d, date: e.target.value }))} />
              <AuthorsField value={pendingDetails.authors} onChange={(authors) => setPendingDetails((d) => ({ ...d, authors }))} />
              <TextField size="small" label={tMaps('mapNote')} fullWidth multiline minRows={2} value={pendingDetails.note} onChange={(e) => setPendingDetails((d) => ({ ...d, note: e.target.value }))} sx={{ '& textarea': { resize: 'vertical' } }} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelPendingUpload} disabled={uploading}>
            {tMaps('cancel')}
          </Button>
          <Button variant="contained" onClick={confirmUpload} disabled={uploading || !pendingDetails.title.trim()} startIcon={uploading ? <CircularProgress size={16} /> : undefined}>
            {tMaps('add')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
