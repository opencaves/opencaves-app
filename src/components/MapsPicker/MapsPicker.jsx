import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Box, Button, Card, CardActionArea, CircularProgress, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, TextField, Typography } from '@mui/material'
import { AddRounded, CloseRounded, DescriptionRounded, ImageRounded } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import AuthorsField from './AuthorsField.jsx'
import MapSistemaField from './MapSistemaField.jsx'
import PendingFilePreview from './PendingFilePreview.jsx'
import MapUploadFeedback, { useMapUpload } from './MapUpload.jsx'

const emptyPendingDetails = { title: '', date: '', authors: [], note: '' }

const mapsModel = createCollectionModel('maps')

// PDFs can't be thumbnailed with a plain <img src>, so until their
// conversion (onMapPdfUploaded) adds a thumbnail/preview they fall back to a
// generic file icon; image maps show an actual miniature of the file.
function MapThumbnail({ map, size }) {
  const sx = { width: size, height: size }
  if (map.contentType === 'application/pdf' && !map.previewUrl && !map.thumbnailUrl) {
    return (
      <Avatar variant="rounded" sx={sx}>
        <DescriptionRounded fontSize="small" />
      </Avatar>
    )
  }
  return (
    <Avatar variant="rounded" src={map.thumbnailUrl || map.previewUrl || map.url} slotProps={{ img: { crossOrigin: 'anonymous' } }} sx={sx}>
      <ImageRounded fontSize="small" />
    </Avatar>
  )
}

// A shared library of map files (survey maps: images or PDFs), picked from
// by every sistema - not scoped to one sistema, same sharing model as
// ColorPicker's `colors` palette. `value` is an array of map doc IDs;
// `onChange` receives the updated array.
export default function MapsPicker({ label, value = [], onChange, sistemaName = '' }) {
  const { t } = useTranslation('mapsPicker')
  const [maps] = mapsModel.useAll()
  const [anchorEl, setAnchorEl] = useState(null)
  const { uploadMap, uploading, progress, current, error, success, clearError } = useMapUpload()
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingDetails, setPendingDetails] = useState(emptyPendingDetails)
  const open = Boolean(anchorEl)

  const selectedMaps = value.map((id) => maps.find((m) => m.id === id)).filter(Boolean)

  function handleOpen(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
    setPendingFile(null)
    setPendingDetails(emptyPendingDetails)
  }

  function toggle(id) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function removeChip(id) {
    onChange(value.filter((v) => v !== id))
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setPendingFile(file)
    setPendingDetails({ ...emptyPendingDetails, title: sistemaName })
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
    })
    if (!uploaded) return

    onChange([...value, uploaded.id])
    handleClose()
  }

  return (
    <Box className="oc-maps-picker">
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
        {selectedMaps.map((m) => (
          <Card key={m.id} className="oc-maps-picker--card" title={[m.date, m.authors?.join(', ')].filter(Boolean).join(' · ') || undefined} sx={{ width: 160, position: 'relative', flexShrink: 0 }}>
            <IconButton size="small" onClick={() => removeChip(m.id)} aria-label={t('removeMap')} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
              <CloseRounded fontSize="small" />
            </IconButton>
            <CardActionArea component="a" href={m.previewUrl || m.url} target="_blank" rel="noopener noreferrer">
              <Box sx={{ height: 120, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{m.contentType === 'application/pdf' && !m.previewUrl && !m.thumbnailUrl ? <DescriptionRounded sx={{ fontSize: 48, color: 'text.secondary' }} /> : <Box component="img" src={m.thumbnailUrl || m.previewUrl || m.url} alt={m.name} crossOrigin="anonymous" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</Box>
              <Typography variant="body2" noWrap sx={{ display: 'block', px: 1, py: 0.75 }}>
                {m.name}
              </Typography>
            </CardActionArea>
            {m.contentType === 'application/pdf' && (
              <Button component="a" href={m.url} target="_blank" rel="noopener noreferrer" size="small" sx={{ mx: 0.5 }}>
                {t('originalFile')}
              </Button>
            )}
          </Card>
        ))}
        <Button className="oc-maps-picker--add-btn" size="small" startIcon={<AddRounded />} onClick={handleOpen}>
          {t('addMap')}
        </Button>
      </Box>

      <Menu className="oc-maps-picker--menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        {pendingFile ? (
          <Box className="oc-maps-picker--upload-details" sx={{ width: 900, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ width: 440, height: 440, flexShrink: 0 }}>
                <PendingFilePreview file={pendingFile} width={440} height={440} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap title={pendingFile.name}>
                  {pendingFile.name}
                </Typography>
                <MapSistemaField autoFocus value={pendingDetails.title} onChange={(title) => setPendingDetails((d) => ({ ...d, title }))} />
                <TextField size="small" label={t('mapDate')} placeholder={t('mapDatePlaceholder')} sx={{ width: 200 }} value={pendingDetails.date} onChange={(e) => setPendingDetails((d) => ({ ...d, date: e.target.value }))} />
                <AuthorsField value={pendingDetails.authors} onChange={(authors) => setPendingDetails((d) => ({ ...d, authors }))} />
                <TextField size="small" label={t('mapNote')} fullWidth multiline minRows={2} value={pendingDetails.note} onChange={(e) => setPendingDetails((d) => ({ ...d, note: e.target.value }))} sx={{ '& textarea': { resize: 'vertical' } }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={cancelPendingUpload} disabled={uploading}>
                {t('cancel')}
              </Button>
              <Button size="small" variant="contained" onClick={confirmUpload} disabled={uploading || !pendingDetails.title.trim()} startIcon={uploading ? <CircularProgress size={16} /> : undefined}>
                {t('add')}
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ width: 280, px: 1.5, pt: 1 }}>
              <List dense disablePadding sx={{ maxHeight: 260, overflowY: 'auto' }}>
                {maps.map((m) => (
                  <ListItemButton key={m.id} selected={value.includes(m.id)} onClick={() => toggle(m.id)}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <MapThumbnail map={m} size={28} />
                    </ListItemIcon>
                    <ListItemText primary={m.name} secondary={[m.date, m.authors?.join(', ')].filter(Boolean).join(' · ') || undefined} />
                  </ListItemButton>
                ))}
                {maps.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
                    {t('empty')}
                  </Typography>
                )}
              </List>
            </Box>
            <Box sx={{ px: 1.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button component="label" size="small" startIcon={<AddRounded />}>
                {t('upload')}
                <input type="file" hidden accept="image/*,application/pdf" onChange={handleFileSelected} />
              </Button>
            </Box>
          </>
        )}
      </Menu>
      <MapUploadFeedback uploading={uploading} progress={progress} current={current} error={error} success={success} clearError={clearError} />
    </Box>
  )
}
