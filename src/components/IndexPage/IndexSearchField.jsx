import { useCallback, useDeferredValue, useEffect, useRef, useState, startTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { SEARCH_FIELD_SX } from '@/components/searchFieldSx.js'
import { foldSearch, searchMatcher } from '@/utils/searchText.js'

// Names compared as every search of the site does (utils/searchText.js):
// "Chac Mól", "Chac-Mol" and "chacmol" match "chac mol".
export const fold = foldSearch

// An index page's search, kept in the address (?q=), so Back and a shared
// link keep it. matches(texts): every word of the search is in one of the
// texts (a record's name, other names, system, area...); matchesFolded: the
// same in a text already folded (fold) - a long list's, prepared once.
// query is the field's (as typed, its own state: the address only follows
// it once typing pauses - written on every letter, a fast second letter was
// lost); the matching follows it a little behind (useDeferredValue), so
// typing never waits for a long list to redraw.
export function useIndexSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addressQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(addressQuery)
  // The search last written to (or read from) the address.
  const written = useRef(addressQuery)
  // Back or Forward changing the address: the field follows.
  useEffect(() => {
    if (addressQuery === written.current) return
    written.current = addressQuery
    setQuery(addressQuery)
  }, [addressQuery])
  // The address follows the field, once typing pauses.
  useEffect(() => {
    if (query === written.current) return undefined
    const timer = setTimeout(() => {
      written.current = query
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params)
          if (query) next.set('q', query)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [query, setSearchParams])
  const deferredQuery = useDeferredValue(query)
  const words = fold(deferredQuery).split(' ').filter(Boolean)
  const matchesFolded = useCallback((haystack) => words.length === 0 || searchMatcher(deferredQuery)(haystack),
    // words is derived from deferredQuery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredQuery])
  const matches = useCallback((texts) => words.length === 0 || matchesFolded(texts.map(fold).join(' ')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredQuery])
  return { query, setQuery, matches, matchesFolded, searching: words.length > 0, searchedQuery: deferredQuery }
}

// How many of a long page's sections to draw: the first few at once, then a
// few more in each background render after (the page shows, and scrolls,
// before every row is drawn, and no single redraw is long). Again from the
// first few when the sections change (resetKey: a new search's).
export function useProgressiveCount(total, resetKey, { first = 3, step = 3 } = {}) {
  const [state, setState] = useState({ key: resetKey, count: first })
  const count = state.key === resetKey ? state.count : first
  useEffect(() => {
    if (state.key !== resetKey) {
      setState({ key: resetKey, count: first })
      return undefined
    }
    if (count >= total) return undefined
    const timer = setTimeout(() => startTransition(() => setState((current) => ({ ...current, count: current.count + step }))))
    return () => clearTimeout(timer)
  }, [state, resetKey, count, total, first, step])
  return Math.min(count, total)
}

// The search field above an index page's list, and its result line
// (status), kept in view below the app bar while the list scrolls by. Only
// the field itself is opaque (the list passes under it around the field).
export default function IndexSearchField({ query, setQuery, placeholder, status }) {
  const { t } = useTranslation('indexPages')
  // Its height, for what sticks under it (IndexSection's stickyTitle):
  // --oc-index-search-height, with the result line when it shows.
  const barRef = useRef(null)
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return undefined
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--oc-index-search-height', `${bar.offsetHeight}px`))
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--oc-index-search-height')
    }
  }, [])
  return (
    <Box
      ref={barRef}
      className="oc-index-search-field--bar"
      sx={{
        position: 'sticky',
        // The app bar's height (64px, as MD3's small top app bar).
        top: 64,
        zIndex: 2,
        pt: 1,
        pb: 1.5,
        mb: 2,
      }}
    >
    <TextField
      className="oc-index-search-field"
      type="search"
      fullWidth
      variant="outlined"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder={placeholder}
      // MD3's search bar, as the editors' lists' search (CaveList, SistemaList).
      sx={SEARCH_FIELD_SX}
      slotProps={{
        htmlInput: { 'aria-label': placeholder, spellCheck: false },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded />
            </InputAdornment>
          ),
          endAdornment: query && (
            <InputAdornment position="end">
              <IconButton onClick={() => setQuery('')} aria-label={t('search.clear')}>
                <CloseRounded />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
    {status && (
      <Typography className="oc-index-search-field--status" variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
        {status}
      </Typography>
    )}
    </Box>
  )
}
