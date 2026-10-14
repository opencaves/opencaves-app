import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, ClickAwayListener, IconButton, InputAdornment, InputBase, Tooltip, useTheme } from '@mui/material'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { useSiteSearch } from '@/hooks/useSiteSearch.js'
import { renderSearchGroup, renderSearchOption } from '@/components/IndexPage/searchSuggestions.jsx'
import { track } from '@/utils/track.js'

/**
 * The app bar's search, on every page but the map (which has its own): the
 * caves and the cave systems ({@link useSiteSearch}). Picking one opens its page
 * (/caves/:id, /sistemas/:id);
 * Enter on free text opens the caves' list filtered by it. A search button
 * that opens the field over the bar's links (wide screens: from the links'
 * start to the button, the logo and the account left in sight) or over the
 * whole bar (narrower, where the links are in the drawer) - revealed in a circle growing from the button, and closed
 * back into it (M3's container transform, as a circular reveal). Empty, it
 * also closes on Escape or a click elsewhere; with text, Escape or its ×
 * button clears it.
 */
export default function AppBarSearch() {
  const { t } = useTranslation('appBarSearch')
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  // The overlay stays mounted while it closes; revealed drives its circle,
  // grown from the search button's center (origin).
  const [mounted, setMounted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [origin, setOrigin] = useState(null)
  // Where it opens, in the window: its left and right edges' distances from
  // the window's sides (the whole bar: 0, 0).
  const [span, setSpan] = useState({ left: 0, right: 0 })
  const buttonRef = useRef(null)
  const closeTimer = useRef(null)
  const inputRef = useRef(null)
  const suggestions = useSiteSearch(input)
  const placeholder = t('placeholder')

  const motion = theme.sys.motion

  // Over the bar's links when they're in it, up to the button; else the
  // whole bar.
  function measureSpan() {
    const rect = buttonRef.current?.getBoundingClientRect()
    const nav = document.querySelector('.oc-app-bar--nav')?.getBoundingClientRect()
    const next = rect && nav ? { left: nav.left, right: document.documentElement.clientWidth - rect.right } : { left: 0, right: 0 }
    setSpan(next)
    return next
  }

  function openOverlay() {
    clearTimeout(closeTimer.current)
    const rect = buttonRef.current?.getBoundingClientRect()
    const { left } = measureSpan()
    // In the overlay's own box (its clip-path's).
    if (rect) setOrigin({ x: rect.left + rect.width / 2 - left, y: rect.top + rect.height / 2 })
    setMounted(true)
    setOpen(true)
    // Mounted closed first, then grown: the transition needs both states.
    requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)))
  }

  // animate false: gone at once (a new page).
  function closeOverlay({ animate = true } = {}) {
    setOpen(false)
    setRevealed(false)
    clearTimeout(closeTimer.current)
    if (!animate) {
      setMounted(false)
      return
    }
    closeTimer.current = setTimeout(() => setMounted(false), motion.duration.emphasizedAccelerate)
    buttonRef.current?.focus()
  }

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  // A new page: the search starts over (and its overlay closes).
  useEffect(() => {
    setInput('')
    closeOverlay({ animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // The window resized while it's open: over the links where they now are.
  useEffect(() => {
    if (!open) return undefined
    window.addEventListener('resize', measureSpan)
    return () => window.removeEventListener('resize', measureSpan)
  }, [open])

  if (location.pathname === '/map' || location.pathname.startsWith('/map/')) return null

  function searchAll() {
    const text = input.trim()
    track('search', { search_term: text })
    navigate(text ? `/caves?q=${encodeURIComponent(text)}` : '/caves')
  }

  const field = (
    <Box
      component="form"
      role="search"
      aria-label={placeholder}
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
          if (value && typeof value === 'object') {
            track('search', { search_term: input.trim() })
            track('select_search_result', { content_type: value.kind, item_id: value.recordId })
            navigate(value.to)
          }
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
            // With text: a button emptying it (the field keeps the focus).
            endAdornment={input && (
              <InputAdornment position="end" sx={{ color: 'inherit', mr: -0.5 }}>
                <IconButton
                  className="oc-app-bar-search--clear"
                  size="small"
                  color="inherit"
                  aria-label={t('clear')}
                  onClick={() => {
                    setInput('')
                    inputRef.current?.focus()
                  }}
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </InputAdornment>
            )}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              // Its text cleared first, then closed.
              if (input) setInput('')
              else closeOverlay()
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

  return (
    <>
      <Tooltip title={t('open')}>
        <IconButton ref={buttonRef} color="inherit" aria-label={t('open')} aria-expanded={open} onClick={openOverlay} sx={{ p: 1.5 }}>
          <SearchRounded />
        </IconButton>
      </Tooltip>
      {mounted && (
        // Over the bar's links or the whole bar (fixed, like it: 64px at the
        // top), in its colors: the field. Empty, a click
        // or tap anywhere else closes it (its suggestions, in a portal, count
        // as inside).
        <ClickAwayListener onClickAway={() => open && !input && closeOverlay()}>
          <Box
            className="oc-app-bar-search--overlay"
            sx={(theme) => {
              const at = origin ? `${origin.x}px ${origin.y}px` : 'right center'
              return {
                position: 'fixed',
                top: 0,
                left: span.left,
                right: span.right,
                height: 64,
                zIndex: theme.zIndex.appBar + 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: { xs: 0.5, sm: 2 },
                bgcolor: 'var(--oc-app-bar-bg)',
                color: 'var(--oc-app-bar-fg)',
                // Wider than the bar's diagonal from any point in it.
                clipPath: revealed ? `circle(150vmax at ${at})` : `circle(24px at ${at})`,
                opacity: revealed ? 1 : 0,
                transition: revealed
                  ? `clip-path ${motion.duration.emphasizedDecelerate}ms ${motion.easing.emphasizedDecelerate}, opacity ${motion.duration.standardDecelerate}ms linear`
                  : `clip-path ${motion.duration.emphasizedAccelerate}ms ${motion.easing.emphasizedAccelerate}, opacity ${motion.duration.emphasizedAccelerate}ms ${motion.easing.emphasizedAccelerate}`,
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', pr: { xs: 1, sm: 0 } }}>{field}</Box>
          </Box>
        </ClickAwayListener>
      )}
    </>
  )
}
