import { IonSearchbar, IonIcon, IonMenuButton } from '@ionic/react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useMiniSearch } from 'react-minisearch'
import Tooltip from '../Tooltip'
import { filter } from 'ionicons/icons'
import './SearchBar.scss'
import { useEffect, useState } from 'react'

const miniSearchOptions = {
  fields: ['name'],
  storeFields: ['name'],
  searchOptions: { prefix: true },
}

export default function SearchBar() {

  const [value, setValue] = useState()
  const { t } = useTranslation()
  const data = useSelector(state => state.map.data)
  const currentCave = useSelector(state => state.map.currentCave)
  // const { search, searchResults } = useMiniSearch([], miniSearchOptions)

  useEffect(() => {
    console.log('[SearchBar] useEffect: %o', currentCave)
    if (currentCave) {
      setValue(currentCave.name)
    }
  }, [currentCave])

  function handleSearchChange(event) {
    // search(event.target.value)
  }


  return (
    <div className="oc-search-bar">
      <IonSearchbar class="oc-search-bar--input" value={value} placeholder={t('searchBar.placeholder')} show-clear-button={currentCave ? 'always' : 'focus'} onIonChange={handleSearchChange} />
      {/* <ol>
        {
          searchResults && searchResults.map((result, i) => {
            return <li key={i}>{result.name}</li>
          })
        }
      </ol> */}
      <Tooltip title={t('searchBar.filter.tip')}>
        <IonMenuButton id="oc-search-filter-btn" aria-label={t('searchBar.filter.ariaLabel')}><IonIcon icon={filter} aria-hidden="true"></IonIcon></IonMenuButton></Tooltip>
    </div>
  )
}
