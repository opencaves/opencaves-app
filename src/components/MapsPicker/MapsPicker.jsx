import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { Box, Button, Chip, CircularProgress, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, Typography } from '@mui/material'
import { AddRounded, DescriptionRounded, ImageRounded } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { storage } from '@/config/firebase.js'

const mapsModel = createCollectionModel('maps')

// A shared library of map files (survey maps: images or PDFs), picked from
// by every sistema - not scoped to one sistema, same sharing model as
// ColorPicker's `colors` palette. `value` is an array of map doc IDs;
// `onChange` receives the updated array.
export default function MapsPicker({ label, value = [], onChange }) {
  const { t } = useTranslation('mapsPicker')
  const [maps] = mapsModel.useAll()
  const [anchorEl, setAnchorEl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const open = Boolean(anchorEl)

  const selectedMaps = value.map((id) => maps.find((m) => m.id === id)).filter(Boolean)

  function handleOpen(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  function toggle(id) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function removeChip(id) {
    onChange(value.filter((v) => v !== id))
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setUploading(true)
    try {
      const id = pushId()
      const storageRef = ref(storage, `maps/${id}`)
      await uploadBytesResumable(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await mapsModel.save(id, { name: file.name, url, contentType: file.type })
      invalidateData()
      await getData()
      onChange([...value, id])
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box className="oc-maps-picker">
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {selectedMaps.map((m) => (
          <Chip key={m.id} label={m.name} onDelete={() => removeChip(m.id)} component="a" href={m.url} target="_blank" rel="noopener" clickable />
        ))}
        <IconButton
          className="oc-maps-picker--add-btn"
          size="small"
          onClick={handleOpen}
          aria-label={t('addMap')}
          sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 0.5 }}
        >
          <AddRounded fontSize="small" />
        </IconButton>
      </Box>

      <Menu className="oc-maps-picker--menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        <Box sx={{ width: 280, px: 1.5, pt: 1 }}>
          <List dense disablePadding sx={{ maxHeight: 260, overflowY: 'auto' }}>
            {maps.map((m) => (
              <ListItemButton key={m.id} selected={value.includes(m.id)} onClick={() => toggle(m.id)}>
                <ListItemIcon sx={{ minWidth: 32 }}>{m.contentType === 'application/pdf' ? <DescriptionRounded fontSize="small" /> : <ImageRounded fontSize="small" />}</ListItemIcon>
                <ListItemText primary={m.name} />
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
          <Button component="label" size="small" startIcon={uploading ? <CircularProgress size={16} /> : <AddRounded />} disabled={uploading}>
            {t('upload')}
            <input type="file" hidden accept="image/*,application/pdf" onChange={handleUpload} />
          </Button>
        </Box>
      </Menu>
    </Box>
  )
}
