import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import pushId from 'unique-push-id'
import { Box, Button, IconButton, InputAdornment, Menu, TextField, Tooltip } from '@mui/material'
import { AddRounded, ArrowDropDownRounded } from '@mui/icons-material'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'

const colorsModel = createCollectionModel('colors')

const swatchSx = {
  width: 28,
  height: 28,
  borderRadius: 0.5,
  p: 0,
  cursor: 'pointer',
  boxSizing: 'border-box',
}

// A shared color picker, presented as a dropdown (closed trigger showing the
// current color, opening a palette menu) so it fits the same visual slot as
// the other TextField selects around it. The palette is drawn from the
// `colors` reference-data collection (the same one ReferenceDataEditor.jsx
// manages), so every entity picking a color draws from - and can grow - the
// same shared palette, instead of each place free-typing its own hex value.
export default function ColorPicker({ label, value, onChange, saveOnAdd = true }) {
  const { t } = useTranslation('colorPicker')
  const [colors] = colorsModel.useAll()
  const [anchorEl, setAnchorEl] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newColor, setNewColor] = useState('#ffffff')
  const [saving, setSaving] = useState(false)
  const open = Boolean(anchorEl)

  function handleOpen(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
    setAdding(false)
  }

  function handleSelect(hex) {
    onChange(hex)
    handleClose()
  }

  async function handleAddColor() {
    if (saveOnAdd) {
      setSaving(true)
      try {
        await colorsModel.save(pushId(), { hex: newColor })
        invalidateData()
        await getData()
        handleSelect(newColor)
      } finally {
        setSaving(false)
      }
    } else {
      handleSelect(newColor)
    }
  }

  return (
    <Box className="oc-color-picker">
      <TextField
        label={label}
        fullWidth
        value={value || ''}
        onClick={handleOpen}
        slotProps={{
          input: {
            readOnly: true,
            sx: { cursor: 'pointer', caretColor: 'transparent' },
            startAdornment: value ? (
              <InputAdornment position="start">
                <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: value, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
              </InputAdornment>
            ) : undefined,
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDropDownRounded sx={{ color: 'action.active' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Menu className="oc-color-picker--menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1.5, width: 232 }}>
          {colors.map((c) => (
            <Tooltip key={c.id} title={c.hex}>
              <Box
                component="button"
                type="button"
                onClick={() => handleSelect(c.hex)}
                aria-label={c.hex}
                sx={{
                  ...swatchSx,
                  bgcolor: c.hex,
                  border: '2px solid',
                  borderColor: value === c.hex ? 'primary.main' : 'divider',
                }}
              />
            </Tooltip>
          ))}

          <Tooltip title={t('addColor')}>
            <IconButton
              className="oc-color-picker--add-btn"
              size="small"
              onClick={() => {
                const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value)
                setNewColor(isValidHex ? value : '#ffffff')
                setAdding(true)
              }}
              sx={{ ...swatchSx, border: '1px dashed', borderColor: 'divider' }}
            >
              <AddRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {adding && (
          <Box className="oc-color-picker--add-form" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pb: 1.5 }}>
            <Box component="input" type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} sx={{ width: 36, height: 36, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 0.5, cursor: 'pointer' }} />
            <Button size="small" onClick={() => setAdding(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button size="small" variant="contained" onClick={handleAddColor} disabled={saving}>
              {t('add')}
            </Button>
          </Box>
        )}
      </Menu>
    </Box>
  )
}
