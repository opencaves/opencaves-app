import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'

// Lowercase, accents dropped: "Chac Mól" matches "chac mol".
const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// An index page's search, kept in the address (?q=), so Back and a shared
// link keep it. matches(texts): every word of the search is in one of the
// texts (a record's name, other names, system, area...).
export function useIndexSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const setQuery = useCallback((value) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }, [setSearchParams])
  const words = fold(query).split(/\s+/).filter(Boolean)
  const matches = useCallback((texts) => {
    if (words.length === 0) return true
    const haystack = texts.map(fold).join(' ')
    return words.every((word) => haystack.includes(word))
    // words is derived from query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return { query, setQuery, matches, searching: words.length > 0 }
}

// The search field above an index page's list.
export default function IndexSearchField({ query, setQuery, placeholder }) {
  const { t } = useTranslation('indexPages')
  return (
    <TextField
      className="oc-index-search-field"
      type="search"
      fullWidth
      size="small"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={placeholder}
      sx={{ mb: 3, maxWidth: 560 }}
      slotProps={{
        htmlInput: { 'aria-label': placeholder },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded />
            </InputAdornment>
          ),
          endAdornment: query && (
            <InputAdornment position="end">
              <IconButton edge="end" size="small" onClick={() => setQuery('')} aria-label={t('search.clear')}>
                <CloseRounded fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
