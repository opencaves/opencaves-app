import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Collapse } from '@mui/material'
import { TransitionGroup } from 'react-transition-group'
import ResultPaneSm from './ResultPaneSm'
import ResultPaneLg from './ResultPaneLg'
import CurrentCaveDetailsHeader from './CurrentCaveDetailsHeader'
import CurrentCaveDetailsContent from './CurrentCaveDetailsContent'
import { loadMediaCount, loadMediaList } from './MediaList'
import { getCaveById } from '@/models/Cave'
import { useTitle } from '@/hooks/useTitle'
import { useSmall } from '@/hooks/useSmall'
import { setCurrentCave } from '@/redux/slices/mapSlice'
import './ResultPane.scss'

export async function resultPaneLoader({ params }) {
  const { caveId } = params
  const [mediaList, mediaCount] = await Promise.all([
    loadMediaList(caveId),
    loadMediaCount(caveId)
  ])

  return { mediaList, mediaCount }
}

export default function ResultPane() {
  const { t } = useTranslation('resultPane')
  const { caveId } = useParams()
  const dispatch = useDispatch()
  const caves = useSelector(state => state.map.data)
  const isSmall = useSmall()
  const { setTitle } = useTitle()
  const [currentCave, _setCurrentCave] = useState()

  useEffect(() => {

    if (caves && caves.length > 0) {
      const currentCave = getCaveById(caveId)

      if (currentCave) {
        _setCurrentCave(currentCave)
        dispatch(setCurrentCave(currentCave))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caves, caveId])


  useEffect(() => {
    if (currentCave) {
      setTitle(t('title', { name: currentCave.name.value }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCave])

  if (currentCave) {
    return (
      <>
        {
          isSmall ? (
            <TransitionGroup>
              <Collapse in={!!currentCave}>
                <ResultPaneSm id="result-pane" cave={currentCave}>
                  <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
                  <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
                </ResultPaneSm>
              </Collapse>
            </TransitionGroup>
          ) : (
            <TransitionGroup>
              <Collapse in={!!currentCave}>
                <ResultPaneLg id="result-pane" cave={currentCave}>
                  <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>
                  <CurrentCaveDetailsContent cave={currentCave}></CurrentCaveDetailsContent>
                </ResultPaneLg>
              </Collapse>
            </TransitionGroup>
          )
        }
        <Outlet />
      </>
    )

  }

}