import { Box, IconButton, TextField, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import AddButton from '@/components/AddButton.jsx'

export default function RepeatableTextField({ label, values, onChange, addLabel, removeLabel, labelProps = {} }) {
  function updateAt(index, value) {
    onChange(values.map((v, i) => (i === index ? value : v)))
  }

  function removeAt(index) {
    onChange(values.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...values, ''])
  }

  return (
    <Box className="oc-repeatable-text-field">
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }} {...labelProps}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {values.map((value, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Named after the list's caption, numbered (the caption isn't a <label>). */}
            <TextField size="small" fullWidth value={value} onChange={(e) => updateAt(index, e.target.value)} slotProps={{ htmlInput: { 'aria-label': `${label} ${index + 1}` } }} />
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel}>
              <CloseRounded />
            </IconButton>
          </Box>
        ))}
        <AddButton onClick={add}>{addLabel}</AddButton>
      </Box>
    </Box>
  )
}
