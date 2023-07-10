import { useCallback, useEffect, useRef, useState } from 'react'
import { menuController } from '@ionic/core/components'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import MiniSearch from 'minisearch'
import { Tooltip, Collapse, Fade, IconButton, InputBase, Divider, List, ListItem, ListItemButton, Typography, SvgIcon, Box, styled } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import TuneIcon from '@mui/icons-material/Tune'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import LocationOffOutlinedIcon from '@mui/icons-material/LocationOffOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import { store } from '../../redux/store.js'
import { setCurrentCave } from '../../redux/slices/mapSlice'
import { toggleFilterMenu } from '../../redux/slices/appSlice'
import { SPACE_OR_PUNCTUATION, MAYAN_QUOTATION } from '../../utils/regexes'
import { ReactComponent as LocationUnknownOutlinedIcon } from '../../images/location-validity-unknown.svg'
import './SearchBar.scss'
import { useNavigate } from 'react-router-dom'

const nameTranslationFields = store.getState().data.languages.map(l => `nameTranslations.${l.code}`)

const indexOptions = {
  fields: ['name', ...nameTranslationFields, 'aka', 'location'],
  storeFields: ['name', ...nameTranslationFields, 'aka', 'area', 'location'],
  encode: 'advanced',
  searchOptions: {
    boost: { name: 2 },
    prefix: true
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
      text.replaceAll(MAYAN_QUOTATION, '$1$3').split(SPACE_OR_PUNCTUATION).forEach(term => tokens.add(term))
      tokens = [...tokens.values()]

      return tokens
    }

    return tokens
  }
}

function markHints(result, searchTerm) {
  const hints = {}
  const regexp = new RegExp(`(${searchTerm})`, 'gi')

  result.terms.forEach((term) => {

    result.match[term].forEach((field) => {
      const value = result[field]

      if (typeof value === 'string') {
        hints[field] = value.replace(regexp, '<mark>$1</mark>')
      } else if (Array.isArray(value)) {
        const markedValue = value.reduce((items, v) => {
          if (v.toLowerCase().includes(term)) {
            items.push(v.replace(regexp, '<mark>$1</mark>'))
          }
          return items
        }, [])
        hints[field] = markedValue.length ? markedValue : null
      }
    })
  })

  return hints
}

const ActionButton = styled(IconButton)({
  width: '48px',
  height: '48px',
  position: 'absolute',
  left: 0,
  top: 0
})

const SnippetTextPrimary = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.secondary
}
))

const SnippetTextSecondary = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.vars.palette.text.secondary
}
))

export default function SearchBar() {

  const [value, doSetValue] = useState('')
  const resultItemsRef = useRef([])
  const { t } = useTranslation('searchBar')
  const { t: tMap } = useTranslation('map')
  const data = useSelector(state => state.data.caves)

  const currentCave = useSelector(state => state.map.currentCave)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showClearBtn, setShowClearBtn] = useState(false)
  const [searchBarHasFocus, setSearchBarHasFocus] = useState(false)
  const [backBtnOn, setBackBtnOn] = useState(false)
  const searchIndex = new MiniSearch(indexOptions)

  const navigate = useNavigate()

  const dispatch = useDispatch()

  const resultsItemIconStyle = {
    color: 'text.secondary',
    mr: '19px',
    fontSize: '1.25rem'
  }

  function selectCaveById(id) {
    return data.find(cave => cave.id === id)
  }

  // function getCaveName(name) {
  //   return name ? name.value : tMap('caveNameUnknown')
  // }

  const getCaveName = useCallback(name => {
    return name ? name.value : tMap('caveNameUnknown')
  }, [tMap])

  function setValue(value) {
    setShowClearBtn(!!value)
    doSetValue(value)
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
    if (currentCave) {
      setValue(getCaveName(currentCave.name))
    }
  }, [currentCave, getCaveName])

  function onSearchbarInputChange(event) {
    // console.log('[onSearchbarInputChange¸%o', event)
    const searchTerm = event.target.value
    setValue(searchTerm)
    const searchResults = searchIndex.search(searchTerm, { enrich: true }).slice(0, 10).map(result => {
      result.hints = markHints(result, searchTerm)
      return result
    })

    setSearchResults(searchResults)
  }

  function _onOCSearchbarFocus(event) {
    const hasFocus = event.type === 'focus'
    setSearchBarHasFocus(hasFocus)
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

    dispatch(setCurrentCave(null))
    setValue('')
    navigate(`/map`, { replace: true })
  }

  function onResultsItemClick(id) {
    const selectedCave = selectCaveById(id)
    dispatch(setCurrentCave(selectedCave))
    setValue(selectedCave.name.value)
    setSearchResults([])
    setBackBtnOn(false)
    navigate(`/map/${id}`, { replace: true })
  }

  function onBackBtnClick() {
    restoreSearchState()
  }

  function onFilterBtnClick() {
    menuController.toggle()
    dispatch(toggleFilterMenu(true))
  }

  useEffect(() => {
    setShowSearchResults(searchResults.length > 0 && searchBarHasFocus)
  }, [searchResults, searchBarHasFocus])

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        maxWidth: '100%',
        width: {
          xs: '100%',
          sm: '400px'
        },
        zIndex: 'var(--oc-searchbar-z-index)'
      }}
      role='search'
      className="oc-search-bar"
      onFocus={_onOCSearchbarFocus}
    >
      <Box
        sx={{
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), 0 -1px 0px rgba(0, 0, 0, 0.02)',
          borderRadius: '24px',
          bgcolor: 'background.paper',
          borderColor: theme => theme.palette.mode === 'light' ? 'background.paper' : 'divider',
          borderWidth: 1,
          borderStyle: 'solid',
          m: '0.5rem 0.5rem 0 0.5rem',
        }}
      >

        <Grid
          container
          alignItems='stretch'
        >
          <Grid
            width='48px'
            height='48px'
            position='relative'
            overflow='hidden'
            className='oc-search-bar--actions'
          >
            <Fade in={!backBtnOn}>
              <ActionButton disableRipple aria-label={t('actionButton.search.ariaLabel')}>
                <SearchIcon />
              </ActionButton>
            </Fade>
            <Fade in={backBtnOn}>
              <ActionButton disableRipple aria-label={t('actionButton.back.ariaLabel')} onClick={onBackBtnClick}>
                <ArrowBackIcon />
              </ActionButton>
            </Fade>
          </Grid>
          <InputBase
            value={value}
            sx={{ flex: 1 }}
            placeholder={t('placeholder')}
            fullWidth
            inputProps={{ 'aria-label': 'search google maps' }}
            onChange={onSearchbarInputChange}
            onFocus={onSearchbarInputFocus}
            onBlur={onSearchbarInputFocus}
            onKeyDown={onSearchbarInputKeyDown}
            onKeyUp={onSearchbarInputKeyUp}
          />

          <Box
            sx={{
              width: '48px'
            }}
          >
            {
              showClearBtn && (
                <Tooltip title={t('actionButton.clear.tip')}>
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
              )
            }
          </Box>

          {
            showClearBtn && (
              <Box
              >
                <Divider
                  sx={{
                    height: 'calc(100% - 16px)'
                  }}
                  variant='middle'
                  orientation='vertical' />
              </Box>
            )
          }

          <Tooltip title={t('actionButton.filter.tip')}>
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
        </Grid>
        {
          <Collapse in={showSearchResults}>
            <div
              className='oc-search-bar--results'
            >
              <List
                sx={{
                  fontSize: '0.8125rem'
                }}
              >
                {
                  searchResults.map((result) => {
                    return (
                      <ListItem
                        disablePadding
                        key={result.id}
                        sx={{
                          '&:last-child > .MuiListItemButton-root': {
                            borderRadius: '0 0 12px 12px;'
                          }
                        }}
                      >
                        <ListItemButton ref={element => resultItemsRef.current.push(element)} onClick={() => onResultsItemClick(result.id)}>
                          {
                            result.location === 'valid' ? <LocationOnOutlinedIcon sx={resultsItemIconStyle} /> : result.location === 'unknown' ? <SvgIcon component={LocationUnknownOutlinedIcon} className='test' sx={resultsItemIconStyle} /> : <LocationOffOutlinedIcon sx={resultsItemIconStyle} />
                          }
                          <Box
                            sx={{
                              width: '100%'
                            }}
                          >
                            <Snippet result={result} />
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    )
                  })
                }
              </List>
            </div>
          </Collapse>
        }
      </Box>
    </Box>
  )
}

function Snippet({ result }) {
  const { t } = useTranslation('searchBar')

  if (result.hints.name) {
    return (
      <Grid container>
        <Grid xs>
          <SnippetTextPrimary dangerouslySetInnerHTML={{ __html: result.hints.name }} />
        </Grid>
        <Grid>
          <SnippetTextSecondary>{result.area}</SnippetTextSecondary>
        </Grid>
      </Grid>
    )
  }

  const prop = Object.keys(result.hints)[0]
  if (prop) {
    const value = result.hints[prop]
    return <>
      <Grid container>
        <Grid xs>
          <SnippetTextPrimary>{result.name}</SnippetTextPrimary>
        </Grid>
        <Grid>
          <SnippetTextSecondary
            component='span'
          >{result.area}</SnippetTextSecondary>
        </Grid>
      </Grid>
      <SnippetTextSecondary
        component='div'
        sx={{
          mt: '1px'
        }}
        className='oc-search-bar--results-item-extra'>
        <span dangerouslySetInnerHTML={{ __html: Array.isArray(value) ? value[0] : value }}></span>
        <span> </span>
        <span>({t(`snippet.${prop}`)})</span>
      </SnippetTextSecondary>
    </>
  }
  return (
    <Grid container>
      <Grid xs>
        <SnippetTextPrimary>{result.name}</SnippetTextPrimary>
      </Grid>
      <Grid>
        <SnippetTextSecondary
          component='span'
        >{result.area}</SnippetTextSecondary>
      </Grid>
    </Grid>
  )
}
