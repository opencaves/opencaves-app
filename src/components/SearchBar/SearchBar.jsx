import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import MiniSearch from 'minisearch'
import { Tooltip, Collapse, Fade, IconButton, InputBase, Divider, List, ListItem, ListItemButton, Typography, Box, Grid, styled } from '@mui/material'
import Clear from '@mui/icons-material/Clear'
import Tune from '@mui/icons-material/Tune'
import ArrowBack from '@mui/icons-material/ArrowBack'
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined'
import AppMenu from '@/components/App/AppMenu.jsx'
import MenuRounded from '@mui/icons-material/MenuRounded'
import NavDrawer from '@/components/App/NavDrawer.jsx'
import { store } from '@/redux/store.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { clearCurrentCave } from '@/redux/slices/mapSlice.jsx'
import { toggleFilterMenu } from '@/redux/slices/appSlice.jsx'
import { observeStore } from '@/utils/observeStore.js'
import { SPACE_OR_PUNCTUATION, MAYAN_QUOTATION } from '@/utils/regexes.js'
import { matchesId } from '@/utils/matchesId.js'
import Snippet from './Snippet.jsx'
import { SEARCH_BAR_HEIGHT, SEARCH_BAR_MARGIN, SEARCH_BAR_RADIUS, SEARCH_BAR_SHADOW } from '@/config/app.js'
import './SearchBar.scss'

// flex, not inline: an inline wrapper sits the icon on the text baseline,
// a few pixels above the button's center.
const ArrowBackIcon = () => (
  <Box component="span" aria-hidden="true" sx={{ display: 'flex' }}>
    <ArrowBack />
  </Box>
)
const ClearIcon = () => (
  <Box component="span" aria-hidden="true" sx={{ display: 'flex' }}>
    <Clear />
  </Box>
)
const TuneIcon = () => <Tune aria-hidden="true" />
const LocationOnOutlinedIcon = ({ sx }) => (
  <Box component="span" aria-hidden="true" sx={sx}>
    <LocationOnOutlined />
  </Box>
)
const LocationOffOutlinedIcon = ({ sx }) => (
  <Box component="span" aria-hidden="true" sx={sx}>
    <LocationOnOutlined />
  </Box>
)

const nameTranslationFields = store.getState().data.languages.map((l) => `nameTranslations.${l.code}`)

const indexOptions = {
  fields: ['name', ...nameTranslationFields, 'aka', 'location'],
  storeFields: ['name', ...nameTranslationFields, 'aka', 'area', 'location'],
  encode: 'advanced',
  searchOptions: {
    boost: { name: 2 },
    prefix: true,
  },
  extractField: (document, fieldName) => {
    if (fieldName === 'location') {
      return document.location?.validity
    }

    if (fieldName === 'name') {
      return document.name?.value
    }

    return fieldName.split('.').reduce((doc, key) => doc && doc[key], document)
  },
  tokenize: (text, fieldName) => {
    let tokens = text.split(SPACE_OR_PUNCTUATION)

    if (['location'].includes(fieldName)) {
      return tokens
    }

    // Ajout d'un "synonyme" pour améliorer le repérage
    // ex: `Xa'ay` -> `Xaay`
    if (MAYAN_QUOTATION.test(text)) {
      tokens = new Set(tokens)
      text
        .replaceAll(MAYAN_QUOTATION, '$1$3')
        .split(SPACE_OR_PUNCTUATION)
        .forEach((term) => tokens.add(term))
      tokens = [...tokens.values()]

      return tokens
    }

    return tokens
  },
}

// The snippets are HTML (rendered with dangerouslySetInnerHTML, for the
// <mark>s): every piece of the cave's own text is escaped, only the matches
// wrapped - a cave's name or alias can't inject markup into the page.
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// regexp: one capturing group around the search term, so split() keeps the matches.
function highlight(text, regexp) {
  return String(text)
    .split(regexp)
    .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('')
}

function markHints(result, searchTerm) {
  const hints = {}
  const regexp = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi')

  result.terms.forEach((term) => {
    result.match[term].forEach((field) => {
      const value = result[field]

      if (typeof value === 'string') {
        hints[field] = highlight(value, regexp)
      } else if (Array.isArray(value)) {
        const markedValue = value.reduce((items, v) => {
          if (v.toLowerCase().includes(term)) {
            items.push(highlight(v, regexp))
          }
          return items
        }, [])
        hints[field] = markedValue.length ? markedValue : null
      }
    })
  })

  return hints
}

// Caves found by their ID, which the index doesn't hold (its tokenizer would
// split an ID on its punctuation), shaped like index results. Their snippet
// shows the ID with the matched part marked.
function searchIds(caves, searchTerm) {
  const regexp = new RegExp(`(${escapeRegExp(searchTerm.trim())})`, 'gi')
  return caves
    .filter((cave) => matchesId(cave.id, searchTerm))
    .map((cave) => ({ id: cave.id, name: cave.name?.value, aka: cave.aka, area: cave.area, location: cave.location?.validity, hints: { id: highlight(cave.id, regexp) } }))
}

const ActionButton = styled(IconButton)({
  width: '48px',
  height: '48px',
  position: 'absolute',
  left: 0,
  top: 0,
})

const SnippetTextPrimary = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.secondary,
}))

const SnippetTextSecondary = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.vars.palette.text.secondary,
}))

export default function SearchBar() {
  const searchBarRef = useRef()
  const resultItemsRef = useRef([])
  const [value, doSetValue] = useState('')
  const { t } = useTranslation('searchBar')
  const { t: tMap } = useTranslation('map')

  const data = useSelector((state) => state.data.caves)
  const currentCave = useSelector((state) => state.map.currentCave)
  const searchBarOff = useSelector((state) => state.app.searchBarOff)
  const filterMenuOpen = useSelector((state) => state.app.filterMenuOpen)
  const roles = useSelector((state) => state.session.roles)

  const location = useLocation()
  // Kept in sync with ResultPane.jsx/Map.jsx's own edit-mode check.
  const isEditMode = location.pathname.endsWith('/edit') && roles.includes('editor')

  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showClearBtn, setShowClearBtn] = useState(false)
  const [searchBarHasFocus, setSearchBarHasFocus] = useState(false)
  const [backBtnOn, setBackBtnOn] = useState(false)

  const searchIndex = new MiniSearch(indexOptions)

  const navigate = useNavigate()

  const dispatch = useDispatch()

  const isSmall = useSmall()
  const [navOpen, setNavOpen] = useState(false)

  const resultsItemIconStyle = {
    color: 'text.secondary',
    mr: '19px',
    fontSize: '1.25rem',
  }

  function selectCaveById(id) {
    return data.find((cave) => cave.id === id)
  }

  const getCaveName = useCallback(
    (name) => {
      return name ? name.value : tMap('caveNameUnknown')
    },
    [tMap],
  )

  function setValue(value) {
    setShowClearBtn(!!value)
    doSetValue(value)
  }

  function clearSearchResults() {
    setSearchResults([])
  }

  function restoreSearchState() {
    if (currentCave) {
      setValue(getCaveName(currentCave.name))
    }

    setBackBtnOn(false)
    setSearchResults([])
  }

  searchIndex.addAll(data)

  useEffect(() => {
    const select = (state) => state.map.currentCave
    const onChange = (currentCave) => {
      if (currentCave === null) {
        setValue('')
        clearSearchResults()
        // navigate(`/map`, { replace: true })
      }
    }

    return observeStore(store, select, onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The open cave's name - on a cave's own page only: on /map itself the bar
  // is empty, even while the store still holds the last cave (it's saved
  // between visits, and cleared a moment later by the map).
  const onCavePage = location.pathname.startsWith('/map/')
  useEffect(() => {
    if (currentCave && onCavePage) {
      setValue(getCaveName(currentCave.name))
    }
  }, [currentCave, getCaveName, onCavePage])

  // Slid off-screen (edit mode, or the phone sheet fully open): inert too,
  // so the hidden search landmark and its field leave the tab order and the
  // accessibility tree instead of being reachable while invisible.
  // Edit mode only hides it on desktop, where the wide edit pane takes its
  // place; on a phone the sheet is below it, so it stays until the sheet is
  // fully up (searchBarOff), as when viewing a cave.
  useEffect(() => {
    if (searchBarRef) {
      const off = searchBarOff || (isEditMode && !isSmall)
      searchBarRef.current.classList.toggle('off', off)
      searchBarRef.current.inert = off
    }
  }, [searchBarOff, isEditMode, isSmall])

  function onSearchbarInputChange(event) {
    // console.log('[onSearchbarInputChange¸%o', event)
    const searchTerm = event.target.value
    setValue(searchTerm)
    // ID matches first: a pasted ID means that exact cave.
    const idResults = searchIds(data, searchTerm)
    const idMatched = new Set(idResults.map((result) => result.id))
    const searchResults = [
      ...idResults,
      ...searchIndex
        .search(searchTerm, { enrich: true })
        .filter((result) => !idMatched.has(result.id))
        .map((result) => {
          result.hints = markHints(result, searchTerm)
          return result
        }),
    ].slice(0, 10)

    setSearchResults(searchResults)
  }

  function onSearchbarFocus(event) {
    const hasFocus = event.type === 'focus'
    setSearchBarHasFocus(hasFocus)
  }

  function onSearchbarBlur() {
    setSearchBarHasFocus(false)
  }

  function onSearchbarInputFocus(event) {
    // console.log('[onSearchbarInputFocus] %o', event)
  }

  async function onSearchbarInputKeyUp(event) {
    // Set proper searchbar icon
    if (!backBtnOn && currentCave && getCaveName(currentCave.name) !== value) {
      setBackBtnOn(true)
    }
  }

  async function onSearchbarInputKeyDown(event) {
    // Handle various keyboard events
    if (event.key === 'ArrowDown') {
      if (resultItemsRef.current.length > 0) {
        resultItemsRef.current[0].focus()
      }
    }

    if (event.key === 'Escape') {
      setTimeout(() => {
        restoreSearchState()
      })
    }
  }

  function onSearchbarInputClear() {
    // Emptied here, not only when a cave gets cleared: with none open,
    // there's no cave change to empty it.
    setValue('')
    clearSearchResults()
    setBackBtnOn(false)
    dispatch(clearCurrentCave())
    navigate(`/map`, { replace: true })
  }

  function onResultsItemClick(id) {
    // Let the route update currentCave so Map can detect and fly to a new selection.
    const selectedCave = selectCaveById(id)
    // Close the phone's keyboard: the field kept focus through the tap.
    document.activeElement?.blur()
    setValue(getCaveName(selectedCave.name))
    clearSearchResults()
    setBackBtnOn(false)
    navigate(`/map/${id}`, { replace: true })
  }

  function onBackBtnClick() {
    restoreSearchState()
  }

  function onFilterBtnClick() {
    dispatch(toggleFilterMenu(!filterMenuOpen))
  }

  useEffect(() => {
    setShowSearchResults(searchResults.length > 0 && searchBarHasFocus)
  }, [searchResults, searchBarHasFocus])

  // The real search bar is here: index.html's static shell of it can go.
  useEffect(() => {
    document.getElementById('oc-shell')?.remove()
  }, [])

  // Exposing the search bar height as a css custom property
  useEffect(() => {
    if (searchBarRef) {
      searchBarRef.current.style.setProperty('--oc-searchbar-height', searchBarRef.current.getBoundingClientRect().height)
    }
  }, [searchBarRef])

  return (
    <div className="oc-search-bar" onBlur={onSearchbarBlur}>
      {/* Over the phone's result sheet (an Ionic modal, stacked far above MUI's). */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} zIndex={30000} />
      <Box
        id="oc-search-bar"
        ref={searchBarRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          maxWidth: '100%',
          width: {
            xs: '100%',
            sm: '400px',
          },
          zIndex: `var(--oc-searchbar-${isSmall ? 'sm-' : ''}z-index)`,
          transform: 'translate3d(0, 0, 0)',
          transitionProperty: 'transform',
          transitionDuration: (theme) => `${theme.oc.sys.motion.duration.emphasizedDecelerate}ms`,
          transitionTimingFunction: (theme) => theme.sys.motion.easing.emphasizedDecelerate,
          '&.off': {
            transitionDuration: (theme) => `${theme.oc.sys.motion.duration.emphasizedAccelerate}ms`,
            transitionTimingFunction: (theme) => theme.sys.motion.easing.emphasizedAccelerate,
            transform: 'translate3d(0, calc(calc(var(--oc-searchbar-height) + 10) * -1px), 0)',
          },
        }}
        role="search"
        className="oc-search-bar"
        onFocus={onSearchbarFocus}
      >
        <Box
          sx={{
            boxShadow: SEARCH_BAR_SHADOW,
            borderRadius: SEARCH_BAR_RADIUS,
            bgcolor: 'background.paper',
            // The paper's own colour, invisible in both modes: MD3's search bar
            // has no outline, only its shadow.
            borderColor: 'background.paper',
            borderWidth: 1,
            borderStyle: 'solid',
            m: `${SEARCH_BAR_MARGIN}px ${SEARCH_BAR_MARGIN}px 0`,
          }}
        >
          {/* 56px with its border; 48px buttons centred in it, 4px from its
              ends, so their 24px icons are 16px in (MD3's spacing). */}
          <Grid container className="oc-search-bar--field" sx={{ alignItems: 'center', minHeight: SEARCH_BAR_HEIGHT - 2, px: '3px' }}>
            <Grid
              sx={{
                width: '48px',
                height: '48px',
                position: 'relative',
                overflow: 'hidden',
              }}
              className="oc-search-bar--actions"
            >
              {/* Idle: the menu button, opening the site's navigation drawer
                  (as the app bar's on the other pages); with results open, the
                  back arrow below closes them - one meaning each. */}
              <Fade in={!backBtnOn}>
                <Tooltip title={t('actionButton.menu.tooltip')}>
                  <ActionButton className="oc-search-bar--menu" aria-label={t('actionButton.menu.ariaLabel')} aria-haspopup="true" aria-expanded={navOpen} tabIndex={backBtnOn ? -1 : 0} onClick={() => setNavOpen(true)}>
                    <MenuRounded />
                  </ActionButton>
                </Tooltip>
              </Fade>
              <Fade in={backBtnOn}>
                <ActionButton disableRipple aria-label={t('actionButton.back.ariaLabel')} onClick={onBackBtnClick}>
                  <ArrowBackIcon />
                </ActionButton>
              </Fade>
            </Grid>
            <InputBase value={value} sx={{ flex: 1 }} placeholder={t('placeholder')} fullWidth inputProps={{ 'aria-label': t('inputAriaLabel') }} onChange={onSearchbarInputChange} onFocus={onSearchbarInputFocus} onBlur={onSearchbarInputFocus} onKeyDown={onSearchbarInputKeyDown} onKeyUp={onSearchbarInputKeyUp} />

            <Box
              sx={{
                width: '48px',
              }}
            >
              {showClearBtn && (
                <Tooltip title={t('actionButton.clear.tooltip')}>
                  <IconButton
                    disableRipple
                    aria-label={t('actionButton.clear.ariaLabel')}
                    sx={{
                      width: '48px',
                      height: '48px',
                    }}
                    onClick={onSearchbarInputClear}
                  >
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {showClearBtn && (
              <Box>
                <Divider
                  sx={{
                    height: 'calc(100% - 16px)',
                  }}
                  variant="middle"
                  orientation="vertical"
                />
              </Box>
            )}

            <Tooltip title={t('actionButton.filter.tooltip')}>
              <IconButton
                disableRipple
                id="oc-search-filter-btn"
                aria-label={t('actionButton.filter.ariaLabel')}
                sx={{
                  width: '48px',
                  height: '48px',
                }}
                onClick={onFilterBtnClick}
              >
                <TuneIcon />
              </IconButton>
              {/* <IonMenuButton id="oc-search-filter-btn" aria-label={t('filter.ariaLabel')}><TuneIcon /></IonMenuButton> */}
            </Tooltip>
            {/* MD3's search bar avatar: 30dp, signed in or out. */}
            {isSmall && (
              <AppMenu
                logoSx={{ width: 30, height: 30 }}
                avatarSx={{ width: 30, height: 30, fontSize: '1rem' }}
                sx={{
                  width: '48px',
                  height: '48px',
                  p: 0,
                  bgcolor: 'transparent',
                  ':hover': {
                    bgcolor: 'transparent',
                  },
                }}
              />
            )}
          </Grid>
          {
            <Collapse in={showSearchResults}>
              <div className="oc-search-bar--results">
                <List
                  sx={{
                    fontSize: '0.8125rem',
                  }}
                >
                  {searchResults.map((result) => {
                    return (
                      <ListItem
                        disablePadding
                        key={result.id}
                        sx={{
                          '&:last-child > .MuiListItemButton-root': {
                            borderRadius: '0 0 12px 12px;',
                          },
                        }}
                      >
                        {/* No focus move on press: the input's blur would collapse the results
                            before the press ends, so a quick tap would land on the map instead. */}
                        <ListItemButton ref={(element) => resultItemsRef.current.push(element)} onMouseDown={(event) => event.preventDefault()} onClick={() => onResultsItemClick(result.id)}>
                          {result.location === 'valid' ? <LocationOnOutlinedIcon sx={resultsItemIconStyle} /> : <LocationOffOutlinedIcon sx={resultsItemIconStyle} />}
                          <Box
                            sx={{
                              width: '100%',
                            }}
                          >
                            <Snippet result={result} />
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    )
                  })}
                </List>
              </div>
            </Collapse>
          }
        </Box>
      </Box>
    </div>
  )
}
