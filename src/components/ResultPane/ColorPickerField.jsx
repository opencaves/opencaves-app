import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Popover, TextField, Typography } from '@mui/material'

// Editable "color" field: a swatch button that opens a popover showing
// every color already used elsewhere in the data (so editors reuse the
// existing palette instead of drifting into near-duplicate shades) plus a
// native color input for picking something new.
export default function ColorPickerField({ label, value, onChange }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const colors = useSelector((state) => state.data.colors)
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  function pick(hex) {
    onChange(hex)
    setAnchorEl(null)
  }

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Button onClick={(e) => setAnchorEl(e.currentTarget)} variant="outlined" sx={{ justifyContent: 'flex-start', gap: 1, textTransform: 'none', width: 'fit-content', minWidth: 0 }}>
        <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: value || 'transparent', border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
        {value || t('colorNone')}
      </Button>
      <Popover open={open} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 2, maxWidth: 280 }}>
          <Typography variant="caption" color="text.secondary">
            {t('existingColors')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 2 }}>
            {colors.map((c) => (
              <Box
                key={c.hex}
                onClick={() => pick(c.hex)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: c.hex,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: value === c.hex ? 'text.primary' : 'divider',
                }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('newColor')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            <TextField size="small" placeholder="#rrggbb" value={value || ''} onChange={(e) => onChange(e.target.value)} fullWidth />
          </Box>
        </Box>
      </Popover>
    </Box>
  )
}
