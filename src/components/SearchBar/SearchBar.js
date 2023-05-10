import { IonSearchbar, IonIcon, IonMenuButton, IonList, IonItem, IonLabel, IonNote } from '@ionic/react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import MiniSearch from 'minisearch'
import { filter } from 'ionicons/icons'
import TuneIcon from '@mui/icons-material/Tune'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import Tooltip from '../Tooltip'
import './SearchBar.scss'
import { useEffect, useState } from 'react'

const indexOptions = {
  fields: ['name', 'nameTranslations.en', 'aka'],
  storeFields: ['name', 'nameTranslations.en', 'aka', 'area'],
  encode: 'advanced',
  searchOptions: {
    boost: { name: 2 },
    fuzzy: .1,
    prefix: true
  },
  extractField: (document, fieldName) => {
    return fieldName.split('.').reduce((doc, key) => doc && doc[key], document)
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
  const { t } = useTranslation('searchBar')
  const data = useSelector(state => state.map.data)

  const currentCave = useSelector(state => state.map.currentCave)
  const [searchResults, setSearchResults] = useState([])
  const searchIndex = new MiniSearch(indexOptions)

  searchIndex.addAll(data)

  useEffect(() => {
    if (currentCave) {
      setValue(currentCave.name)
    }
  }, [currentCave])

  function handleSearchChange(event) {
    // console.log(event)
    const searchTerm = event.target.value
    setValue(searchTerm)
    const searchResults = searchIndex.search(searchTerm, { enrich: true }).map(result => {
      result.hints = markHints(result, searchTerm)
      return result
    })
    console.log('searchResults: %o', searchResults)
    setSearchResults(searchResults)
  }

  return (
    <div className="oc-search-bar">
      <div className='oc-search-bar--container'>
        <div className='oc-search-bar--omnibox'>
          <IonSearchbar class="oc-search-bar--input" value={value} placeholder={t('placeholder')} show-clear-button={currentCave ? 'always' : 'focus'} onIonInput={handleSearchChange} />
          <Tooltip title={t('filter.tip')}>
            <IonMenuButton id="oc-search-filter-btn" aria-label={t('filter.ariaLabel')}><TuneIcon /></IonMenuButton>
          </Tooltip>
        </div>
        {
          searchResults.length > 0 &&
          <div className='oc-search-bar--results'>
            <IonList lines='none' className='oc-search-bar--results-list'>
              {
                searchResults.map((result) => {

                  return <IonItem key={result.id} button detail={false} className='oc-search-bar--results-item'>
                    <LocationOnOutlinedIcon slot='start' sx={{ fontSize: 20 }} />
                    <IonLabel><Snippet result={result} /></IonLabel>
                  </IonItem>
                })
              }
            </IonList>
          </div>
        }
      </div>
    </div>
  )
}

function Snippet({ result }) {
  const { t } = useTranslation('searchBar')

  if (result.hints.name) {
    return <div className='g'><div dangerouslySetInnerHTML={{ __html: result.hints.name }}></div><div><IonNote>{result.area}</IonNote></div></div>
  }

  const prop = Object.keys(result.hints)[0]
  if (prop) {
    const value = result.hints[prop]
    return <>
      <div className='g'><div>{result.name}</div><div><IonNote>{result.area}</IonNote></div></div>
      <IonNote className='oc-search-bar--results-item-extra'><span dangerouslySetInnerHTML={{ __html: Array.isArray(value) ? value[0] : value }}></span> ({t(`snippet.${prop}`)})</IonNote></>
  }
  return <div className='g'><div>{result.name}</div><div><IonNote>{result.area}</IonNote></div></div>
}
