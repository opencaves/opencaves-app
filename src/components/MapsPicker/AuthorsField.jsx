import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, TextField } from '@mui/material'
import mapsModel from '@/models/MapModel.js'

/**
 * A chip-style, multi-value authors input suggested from every author name
 * already used across all maps, so repeat contributors get picked
 * consistently instead of being retyped (and possibly misspelled) each time.
 */
export default function AuthorsField({ value, onChange }) {
  const { t } = useTranslation('mapsPicker')
  const [maps] = mapsModel.useAll()
  const [inputValue, setInputValue] = useState('')

  const suggestions = useMemo(() => {
    const authors = new Set()
    maps.forEach((map) => (map.authors || []).forEach((author) => authors.add(author)))
    return [...authors].sort((a, b) => a.localeCompare(b))
  }, [maps])

  function addAuthors(names) {
    const additions = names.map((name) => name.trim()).filter((name) => name && !value.includes(name))
    if (additions.length > 0) {
      onChange([...value, ...additions])
    }
  }

  // Typed text is otherwise lost if the field loses focus without Enter
  // being pressed first (freeSolo's default only commits on Enter or a
  // selection) - committing on blur too means clicking straight into the
  // next field, or the dialog's Save button, doesn't silently drop it.
  function commitPendingInput() {
    if (inputValue.trim()) {
      addAuthors([inputValue])
    }
    setInputValue('')
  }

  return (
    <Box onBlur={commitPendingInput}>
      <Autocomplete
        className="oc-authors-field"
        multiple
        freeSolo
        fullWidth
        size="small"
        options={suggestions}
        value={value}
        inputValue={inputValue}
        onInputChange={(_, newInputValue, reason) => {
          // A comma acts as a delimiter, same as pressing Enter, instead of
          // being typed into an author's name - also handles pasting a
          // comma-separated list in one go.
          if (reason === 'input' && newInputValue.includes(',')) {
            const parts = newInputValue.split(',')
            const remainder = parts.pop()
            addAuthors(parts)
            setInputValue(remainder)
            return
          }
          setInputValue(newInputValue)
        }}
        onChange={(_, newValue) => onChange(newValue.map((author) => author.trim()).filter(Boolean))}
        renderInput={(params) => <TextField {...params} label={t('mapAuthors')} placeholder={value.length === 0 ? t('addAuthor') : undefined} helperText={t('mapAuthorsHint')} />}
      />
    </Box>
  )
}
