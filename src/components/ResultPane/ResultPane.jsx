import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Collapse } from '@mui/material'
import { TransitionGroup } from 'react-transition-group'
import ResultPaneSm from './ResultPaneSm.jsx'
import ResultPaneLg from './ResultPaneLg.jsx'
import CurrentCaveDetailsHeader from './CurrentCaveDetailsHeader.jsx'
import CurrentCaveDetailsContent from './CurrentCaveDetailsContent.jsx'
import CurrentCaveDetailsContentEdit from './CurrentCaveDetailsContentEdit.jsx'
import { loadMediaCount, loadMediaList } from './MediaList.jsx'
import { getCaveById } from '@/models/Cave.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { paneInitialBreakpoint } from '@/config/app.js'
import { setResultPaneSmCurrentBreakpoint, setResultPaneSmOpen, toggleFilterMenu } from '@/redux/slices/appSlice.jsx'
import { setCurrentCave } from '@/redux/slices/mapSlice.jsx'
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
  const navigate = useNavigate()
  const location = useLocation()
  const caves = useSelector(state => state.map.data)
  const roles = useSelector(state => state.session.roles)
  const isSmall = useSmall()
  const { setTitle } = useTitle()
  const [currentCave, _setCurrentCave] = useState()

  // The sistemas pane (and its own nested :sistemaId/edit pane) is only
  // reachable from edit mode and overlays the edit-mode pane, so it must
  // keep counting as edit mode even though its own URL segment isn't
  // literally "edit" - otherwise the underlying pane would flip back to
  // its read-only, narrower state the moment that overlay opens.
  const isEditMode = location.pathname.endsWith('/edit') || location.pathname.includes('/sistemas')

  useEffect(() => {
    if (isEditMode && !roles.includes('editor')) {
      navigate(`/map/${caveId}`, { replace: true })
    }
  }, [isEditMode, roles, caveId, navigate])

  useEffect(() => {
    if (!isSmall || !caveId) {
      return
    }

    dispatch(toggleFilterMenu(false))
    dispatch(setResultPaneSmOpen(true))
    dispatch(setResultPaneSmCurrentBreakpoint(paneInitialBreakpoint))
  }, [caveId, dispatch, isSmall])

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
    // Guard against rendering, even briefly, before the redirect effect
    // above fires for a non-editor who navigated straight to the edit URL.
    const showEditContent = isEditMode && roles.includes('editor')
    const DetailsContent = showEditContent ? CurrentCaveDetailsContentEdit : CurrentCaveDetailsContent

    return (
      <>
        {
          isSmall ? (
            <TransitionGroup>
              <Collapse in={!!currentCave}>
                <ResultPaneSm id="result-pane" cave={currentCave}>
                  {!showEditContent && <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>}
                  <DetailsContent key={currentCave.id} cave={currentCave}></DetailsContent>
                </ResultPaneSm>
              </Collapse>
            </TransitionGroup>
          ) : (
            <TransitionGroup>
              <Collapse in={!!currentCave}>
                <ResultPaneLg id="result-pane" cave={currentCave} editMode={showEditContent}>
                  {!showEditContent && <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>}
                  <DetailsContent key={currentCave.id} cave={currentCave}></DetailsContent>
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