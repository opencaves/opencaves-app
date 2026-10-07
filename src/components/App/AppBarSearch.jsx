import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, IconButton, InputAdornment, InputBase, Tooltip, useTheme } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useSiteSearch } from '@/hooks/useSiteSearch.js'
import { renderSearchGroup, renderSearchOption } from '@/components/IndexPage/searchSuggestions.jsx'

// The app bar's search, on every page but the map (which has its own): the
// caves and the cave systems (useSiteSearch). Picking one opens its page
// (/caves/:id, /sistemas/:id);
// Enter on free text opens the caves' list filtered by it. A pill-shaped
// field in the bar on wide screens; below, a search button that opens the
// field over the whole bar, with a back arrow to close it.
export default function AppBarSearch() {
  const { t } = useTranslation('appBarSearch')
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  // The field fits in the bar beside its links from this width on.
  const compact = useSmall(theme.breakpoints.down('lg'))
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const suggestions = useSiteSearch(input)
  const placeholder = t('placeholder')

  // A new page: the search starts over (and its overlay closes).
  useEffect(() => {
    setInput('')
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (location.pathname === '/map' || location.pathname.startsWith('/map/')) return null

  function searchAll() {
    const text = input.trim()
    navigate(text ? `/caves?q=${encodeURIComponent(text)}` : '/caves')
  }

  const field = (
    <Box
      component="form"
      role="search"
      className="oc-app-bar-search"
      onSubmit={(event) => {
        event.preventDefault()
        searchAll()
      }}
      sx={{ flex: 1, minWidth: 0 }}
    >
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
        renderGroup={renderSearchGroup((group) => t(`groups.${group}`))}
        renderOption={renderSearchOption}
        noOptionsText={input.trim() ? t('none') : t('hint')}
        slotProps={{ popper: { className: 'oc-app-bar-search--popper', sx: { minWidth: 320 } } }}
        renderInput={(params) => (
          // A pill in the bar's colors (--oc-app-bar-search-*, variables.scss).
          // MUI 9 hands the input's props over as slotProps (input: the root's
          // ref; htmlInput: the <input>'s, its ref included).
          <InputBase
            ref={params.slotProps.input.ref}
            inputProps={{ ...params.slotProps.htmlInput, 'aria-label': placeholder }}
            // InputBase joins it with Autocomplete's own (htmlInput's ref).
            inputRef={inputRef}
            placeholder={placeholder}
            startAdornment={
              <InputAdornment position="start" sx={{ color: 'inherit', ml: 0.5 }}>
                <SearchRounded />
              </InputAdornment>
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape' && compact) setOpen(false)
            }}
            sx={{
              width: '100%',
              height: 40,
              px: 1.5,
              borderRadius: 5,
              color: 'var(--oc-app-bar-search-fg)',
              bgcolor: 'var(--oc-app-bar-search-bg)',
              transition: theme.transitions.create('background-color', { duration: 150 }),
              '&:hover': { bgcolor: 'var(--oc-app-bar-search-bg-hover)' },
              '&.Mui-focused': { bgcolor: 'var(--oc-app-bar-search-bg-hover)' },
              '& input::placeholder': { color: 'var(--oc-app-bar-search-placeholder)', opacity: 1 },
            }}
          />
        )}
      />
    </Box>
  )

  if (!compact) {
    return <Box sx={{ display: 'flex', flex: '0 1 360px', minWidth: 200, mx: 1 }}>{field}</Box>
  }

  return (
    <>
      <Tooltip title={t('open')}>
        <IconButton color="inherit" aria-label={t('open')} aria-expanded={open} onClick={() => setOpen(true)} sx={{ p: 1.5 }}>
          <SearchRounded />
        </IconButton>
      </Tooltip>
      {open && (
        // Over the whole bar (fixed, like it: 64px at the top), in its
        // colors: a back arrow, then the field.
        <Box className="oc-app-bar-search--overlay" sx={(theme) => ({ position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: theme.zIndex.appBar + 1, display: 'flex', alignItems: 'center', gap: 0.5, px: { xs: 0.5, sm: 2 }, bgcolor: 'var(--oc-app-bar-bg)', color: 'var(--oc-app-bar-fg)' })}>
          <Tooltip title={t('close')}>
            <IconButton color="inherit" aria-label={t('close')} onClick={() => setOpen(false)} sx={{ p: 1.5 }}>
              <ArrowBackRounded />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', pr: { xs: 1, sm: 0 } }}>{field}</Box>
        </Box>
      )}
    </>
  )
}
