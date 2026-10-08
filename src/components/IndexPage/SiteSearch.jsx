import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { useSiteSearch } from '@/hooks/useSiteSearch.js'
import { renderSearchGroup, renderSearchOption } from './searchSuggestions.jsx'

// A search across the caves, cave systems and areas, with suggestions as one
// types (grouped by kind; a cave shows its system; useSiteSearch): picking
// one opens its page, Enter on free text opens the caves' list filtered by it.
// No button of its own: Enter (the phone keyboard's Search key) submits.
export default function SiteSearch({ sx, inputSx }) {
  const { t } = useTranslation('home')
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const suggestions = useSiteSearch(input, { areas: true })

  function searchAll() {
    const text = input.trim()
    navigate(text ? `/caves?q=${encodeURIComponent(text)}` : '/caves')
  }

  return (
    <Box component="form" role="search" aria-label={t('hero.searchPlaceholder')} className="oc-site-search" onSubmit={(event) => { event.preventDefault(); searchAll() }} sx={{ display: 'flex', ...sx }}>
      <Autocomplete
        freeSolo
        fullWidth
        options={suggestions}
        filterOptions={(options) => options}
        groupBy={(option) => option.kind}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
        inputValue={input}
        onInputChange={(_, value) => setInput(value)}
        onChange={(_, value) => {
          if (value && typeof value === 'object') navigate(value.to)
          else if (typeof value === 'string') searchAll()
        }}
        renderGroup={renderSearchGroup((group) => t(`search.groups.${group}`))}
        renderOption={renderSearchOption}
        noOptionsText={input.trim() ? t('search.none') : t('search.hint')}
        renderInput={(params) => (
          <TextField
            {...params}
            className="oc-site-search--field"
            // Outlined whatever the theme's default, so inputSx can style it.
            variant="outlined"
            // Short: the long one (its name) was cut on phones.
            placeholder={t('hero.searchShort')}
            sx={inputSx}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps?.htmlInput, ...params.inputProps, 'aria-label': t('hero.searchPlaceholder'), enterKeyHint: 'search' },
              input: { ...params.InputProps, ...params.slotProps?.input, startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> },
            }}
          />
        )}
      />
    </Box>
  )
}
