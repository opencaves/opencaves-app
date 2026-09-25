import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import { AddRounded, CloseRounded } from '@mui/icons-material'

export default function RepeatableTextField({ label, values, onChange, addLabel, removeLabel }) {
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
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {values.map((value, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" fullWidth value={value} onChange={(e) => updateAt(index, e.target.value)} />
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddRounded />} onClick={add} sx={{ alignSelf: 'flex-start' }}>
          {addLabel}
        </Button>
      </Box>
    </Box>
  )
}
