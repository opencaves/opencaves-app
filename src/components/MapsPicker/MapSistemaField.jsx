import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, TextField, Typography, createFilterOptions } from '@mui/material'
import SistemaModel from '@/models/SistemaModel.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'

const areasModel = createCollectionModel('areas')
const filterByInput = createFilterOptions()

// A map's title field (labeled "Map title"): suggests every sistema by name,
// with its area to tell same-named sistemas apart, while staying free text
// so a map can still be titled something that isn't a sistema name. The
// value is the plain title string stored as the map's `name`.
export default function MapSistemaField({ value, onChange, autoFocus }) {
  const { t } = useTranslation('mapsPicker')
  const [sistemas] = SistemaModel.useAll()
  const [areas] = areasModel.useAll()
  // Only filter while the user is typing: opening the list on an
  // already-filled title (e.g. when editing a map) still shows every
  // sistema, not just the one matching the current title.
  const [typing, setTyping] = useState(false)

  const options = useMemo(() => {
    const areaNames = new Map(areas.map((area) => [area.id, area.name]))
    return sistemas
      .filter((sistema) => sistema.name)
      .map((sistema) => ({ id: sistema.id, name: sistema.name, area: areaNames.get(sistema.area) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sistemas, areas])

  return (
    <Autocomplete
      className="oc-map-sistema-field"
      freeSolo
      size="small"
      options={options}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
      value={value}
      inputValue={value}
      onInputChange={(_, nextValue, reason) => {
        setTyping(reason === 'input')
        onChange(nextValue)
      }}
      onChange={(_, option) => onChange(typeof option === 'string' ? option : option?.name || '')}
      onClose={() => setTyping(false)}
      filterOptions={(opts, state) => (typing ? filterByInput(opts, state) : opts)}
      isOptionEqualToValue={(option, selected) => option.name === (typeof selected === 'string' ? selected : selected?.name)}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={option.id} {...props}>
          {option.name}
          {option.area && (
            <Typography component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>
              ({option.area})
            </Typography>
          )}
        </Box>
      )}
      renderInput={(params) => <TextField {...params} label={t('mapTitle')} required autoFocus={autoFocus} />}
    />
  )
}
