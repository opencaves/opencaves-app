import { useEffect, useRef, useState } from 'react'
import { IonSearchbar, IonMenuButton, IonList, IonItem, IonLabel, IonNote, IonButton, useIonRouter } from '@ionic/react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import MiniSearch from 'minisearch'
import { Box, styled } from '@mui/system'
import { Tooltip, Collapse, Fade } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import LocationOffOutlinedIcon from '@mui/icons-material/LocationOffOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import { setCurrentCave } from '../../redux/slices/mapSlice.js'
import { SPACE_OR_PUNCTUATION, MAYAN_QUOTATION } from '../../utils/regexes.js'
import { ReactComponent as LocationUnknownOutlinedIcon } from '../../images/location-validity-unknown.svg'
import './SearchBar.scss'


const indexOptions = {
  fields: ['name', 'nameTranslations.en', 'aka', 'location'],
  storeFields: ['name', 'nameTranslations.en', 'aka', 'area', 'location'],
  encode: 'advanced',
  searchOptions: {
    boost: { name: 2 },
    // fuzzy: .1,
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

export default function SearchBar() {

  const [value, setValue] = useState()
  const searchBarRef = useRef()
  const resultItemsRef = useRef([])
  const { t } = useTranslation('searchBar')
  const { t: tMap } = useTranslation('map')
  const data = useSelector(state => state.data.caves)

  const currentCave = useSelector(state => state.map.currentCave)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchBarHasFocus, setSearchBarHasFocus] = useState(false)
  const [backBtnOn, setBackBtnOn] = useState(false)
  const searchIndex = new MiniSearch(indexOptions)
  const router = useIonRouter()
  const dispatch = useDispatch()

  function selectCaveById(id) {
    return data.find(cave => cave.id === id)
  }

  function getCaveName(name) {
    return name ? name.value : tMap('caveNameUnknown')
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
  }, [currentCave])

  function _onIonSearchbarInput(event) {
    // console.log('[_onIonSearchbarInput¸%o', event)
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

  function _onIonSearchbarFocus(event) { }

  async function _onIonSearchbarKeyUp(event) {

    // Set proper searchbar icon
    if (!backBtnOn && currentCave && getCaveName(currentCave.name) !== value) {
      setBackBtnOn(true)
    }
  }

  async function _onIonSearchbarKeyDown(event) {
    console.log('[_onIonSearchbarKeyDown] %o', event)

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

  function _onIonSearchbarClear() {

    dispatch(setCurrentCave(null))
    router.push(`/map`, 'none', 'replace')
  }

  function _onResultsItemClick(id) {
    const selectedCave = selectCaveById(id)
    dispatch(setCurrentCave(selectedCave))
    setSearchResults([])
    setBackBtnOn(false)
    router.push(`/map/${id}`, 'none', 'replace')
  }

  function handleBackBtnClick() {
    restoreSearchState()
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
        p: '0.5rem 0.5rem 0 0.5rem',
        maxWidth: '100%',
        width: {
          xs: '100%',
          sm: '400px'
        },
        zIndex: 'var(--oc-searchbar-z-index)'
      }}
      className="oc-search-bar" onFocus={_onOCSearchbarFocus}>
      <div className='oc-search-bar--container'>
        <div className='oc-search-bar--omnibox'>
          <div className='oc-search-bar--actions'>
            <Fade in={!backBtnOn}>
              <IonButton shape='round' fill='clear' className='oc-search-bar--search-btn'>
                <SearchIcon slot='icon-only'></SearchIcon>
              </IonButton>
            </Fade>
            <Fade in={backBtnOn}>
              <IonButton shape='round' fill='clear' className='oc-search-bar--back-btn' onClick={handleBackBtnClick}>
                <ArrowBackIcon slot='icon-only'></ArrowBackIcon>
              </IonButton>
            </Fade>
          </div>
          <IonSearchbar ref={searchBarRef} class="oc-search-bar--input" value={value} placeholder={t('placeholder')} show-clear-button={currentCave ? 'always' : 'focus'} onIonInput={_onIonSearchbarInput} onIonFocus={_onIonSearchbarFocus} onIonBlur={_onIonSearchbarFocus} onIonClear={_onIonSearchbarClear} onKeyDown={_onIonSearchbarKeyDown} onKeyUp={_onIonSearchbarKeyUp} />
          <Tooltip title={t('filter.tip')}>
            <IonMenuButton id="oc-search-filter-btn" aria-label={t('filter.ariaLabel')}><TuneIcon /></IonMenuButton>
          </Tooltip>
        </div>
        {
          <Collapse in={showSearchResults}>
            <div className='oc-search-bar--results'>
              <IonList lines='none' className='oc-search-bar--results-list'>
                {
                  searchResults.map((result) => {
                    return <IonItem key={result.id} button detail={false} ref={element => resultItemsRef.current.push(element)} onClick={() => _onResultsItemClick(result.id)} className='oc-search-bar--results-item'>
                      {
                        result.location === 'valid' ? <LocationOnOutlinedIcon slot='start' className='oc-search-bar--results-item-icon' /> : result.location === 'unknown' ? <LocationUnknownOutlinedIcon slot='start' className='oc-search-bar--results-item-icon' /> : <LocationOffOutlinedIcon slot='start' className='oc-search-bar--results-item-icon' />
                      }

                      <IonLabel><Snippet result={result} /></IonLabel>
                    </IonItem>
                  })
                }
              </IonList>
            </div>
          </Collapse>
        }
      </div>
    </Box>
  )
}

function Snippet({ result }) {
  const { t } = useTranslation('searchBar')

  if (result.hints.name) {
    return <div className='g'>
      <div dangerouslySetInnerHTML={{ __html: result.hints.name }}></div>
      <div><IonNote>{result.area}</IonNote></div>
    </div>
  }

  const prop = Object.keys(result.hints)[0]
  if (prop) {
    const value = result.hints[prop]
    return <>
      <div className='g'>
        <div>{result.name}</div>
        <div><IonNote>{result.area}</IonNote></div>
      </div>
      <IonNote className='oc-search-bar--results-item-extra'>
        <span dangerouslySetInnerHTML={{ __html: Array.isArray(value) ? value[0] : value }}></span>
        <span> </span>
        <span>({t(`snippet.${prop}`)})</span>
      </IonNote>
    </>
  }
  return <div className='g'><div>{result.name}</div><div><IonNote>{result.area}</IonNote></div></div>
}
