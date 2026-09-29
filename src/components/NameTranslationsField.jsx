import { Box, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import { CloseRounded } from '@mui/icons-material'
import AddButton from '@/components/AddButton.jsx'

// One row per language, each language selectable in at most one row at a
// time (its own current selection stays available to itself, but disappears
// from every other row's options once picked).
export default function NameTranslationsField({ label, rows, languages, onChange, addLabel, removeLabel, languageLabel, valueLabel, labelProps = {} }) {
  const usedLangs = rows.map((r) => r.lang).filter(Boolean)
  const unusedLanguages = languages.filter((l) => !usedLangs.includes(l.code))

  function updateAt(index, patch) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeAt(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...rows, { lang: unusedLanguages[0].code, value: '' }])
  }

  return (
    <Box className="oc-name-translations-field">
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }} {...labelProps}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((row, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField select size="small" label={languageLabel} sx={{ width: 160, flexShrink: 0 }} value={row.lang} onChange={(e) => updateAt(index, { lang: e.target.value })}>
              {/* Keeps the row's language valid while the languages load (or
                  if it's since been removed). */}
              {row.lang && !languages.some((l) => l.code === row.lang) && (
                <MenuItem value={row.lang} sx={{ display: 'none' }}>
                  {row.lang}
                </MenuItem>
              )}
              {languages
                .filter((l) => l.code === row.lang || !usedLangs.includes(l.code))
                .map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.eng}
                  </MenuItem>
                ))}
            </TextField>
            <TextField size="small" label={valueLabel} fullWidth value={row.value} onChange={(e) => updateAt(index, { value: e.target.value })} />
            <IconButton size="small" onClick={() => removeAt(index)} aria-label={removeLabel}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <AddButton onClick={add} disabled={unusedLanguages.length === 0}>
          {addLabel}
        </AddButton>
      </Box>
    </Box>
  )
}
