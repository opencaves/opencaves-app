import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, Button, InputAdornment, TextField, Typography } from '@mui/material'
import SearchRounded from '@mui/icons-material/SearchRounded'

// How many suggestions show at once.
const MAX_SUGGESTIONS = 8

// Lowercase, accents dropped: "Chac Mól" matches "chac mol" (as the index
// pages' search, IndexSearchField).
const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// A search across the caves, cave systems and areas, with suggestions as one
// types (grouped by kind; a cave shows its system): picking one opens its
// page, Enter on free text opens the caves' list filtered by it.
// data: the index pages' data (useIndexData).
export default function SiteSearch({ data, sx, inputSx }) {
  const { t } = useTranslation('home')
  const { t: tIndex } = useTranslation('indexPages')
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  // Every searchable thing once: its label, the texts it's found by, where it leads.
  const entries = useMemo(() => [
    ...data.caves.map((cave) => {
      const sistema = data.sistemasById.get(cave.sistemaId)?.name
      // Its system beside it, unless named like the cave (a leading "Cenote" aside), as on /caves.
      const bare = (name) => fold(name).replace(/^cenote\s+/, '').trim()
      const secondary = sistema && bare(sistema) !== bare(cave.name) ? sistema : null
      return { kind: 'caves', id: `c-${cave.id}`, label: cave.name || tIndex('unnamedCave'), secondary, to: `/caves/${cave.id}`, haystack: fold([cave.name, ...(cave.aka || []), sistema].join(' ')) }
    }),
    ...data.sistemas.map((sistema) => ({ kind: 'sistemas', id: `s-${sistema.id}`, label: sistema.name, to: `/sistemas/${sistema.slug}`, haystack: fold([sistema.name, ...(Array.isArray(sistema.aka) ? sistema.aka : [])].join(' ')) })),
    ...data.areas.filter((area) => area.caves.length > 0).map((area) => ({ kind: 'areas', id: `a-${area.slug}`, label: area.name, to: `/areas/${area.slug}`, haystack: fold(area.name) })),
  ], [data, tIndex])

  // The matches: every word typed found, names starting with the search first.
  const suggestions = useMemo(() => {
    const words = fold(input).split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    const query = fold(input).trim()
    return entries
      .filter((entry) => words.every((word) => entry.haystack.includes(word)))
      .sort((a, b) => (fold(b.label).startsWith(query) - fold(a.label).startsWith(query)) || ['areas', 'sistemas', 'caves'].indexOf(a.kind) - ['areas', 'sistemas', 'caves'].indexOf(b.kind))
      .slice(0, MAX_SUGGESTIONS)
      // Grouped by kind for the list (groupBy needs them together).
      .sort((a, b) => ['areas', 'sistemas', 'caves'].indexOf(a.kind) - ['areas', 'sistemas', 'caves'].indexOf(b.kind))
  }, [entries, input])

  function searchAll() {
    const text = input.trim()
    navigate(text ? `/caves?q=${encodeURIComponent(text)}` : '/caves')
  }

  return (
    <Box component="form" role="search" className="oc-site-search" onSubmit={(event) => { event.preventDefault(); searchAll() }} sx={{ display: 'flex', gap: 1, ...sx }}>
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
        renderGroup={(params) => (
          <li key={params.key}>
            <Typography component="div" variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t(`search.groups.${params.group}`)}
            </Typography>
            <Box component="ul" sx={{ p: 0 }}>
              {params.children}
            </Box>
          </li>
        )}
        renderOption={({ key, ...props }, option) => (
          <li key={key} {...props}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span">{option.label}</Typography>
              {option.secondary && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                  {option.secondary}
                </Typography>
              )}
            </Box>
          </li>
        )}
        noOptionsText={input.trim() ? t('search.none') : t('search.hint')}
        renderInput={(params) => (
          <TextField
            {...params}
            className="oc-site-search--field"
            // Outlined whatever the theme's default, so inputSx can style it.
            variant="outlined"
            placeholder={t('hero.searchPlaceholder')}
            sx={inputSx}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps?.htmlInput, ...params.inputProps, 'aria-label': t('hero.searchPlaceholder') },
              input: { ...params.InputProps, ...params.slotProps?.input, startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> },
            }}
          />
        )}
      />
      <Button type="submit" variant="contained" sx={{ borderRadius: 6, px: 3, flexShrink: 0 }}>
        {t('hero.search')}
      </Button>
    </Box>
  )
}
