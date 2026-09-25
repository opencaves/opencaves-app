import { useEffect, useRef, useState } from 'react'
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
import Dropzone from '@/components/AddMedias/Dropzone.jsx'
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
  const [dropzoneOpen, setDropzoneOpen] = useState(false)
  const dragCounter = useRef(0)

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

  // Dragging a file anywhere over the window (not just onto a dedicated
  // dropzone) opens the same full-screen upload prompt used in the media
  // pane, for as long as a cave's details pane is open. Listening on
  // `window` rather than a container element is what makes this cover the
  // whole window, including the map area, which lives outside this
  // component's own DOM subtree. The enter/leave counter is needed because
  // the browser fires dragenter/dragleave for every child element the
  // pointer passes over, not just once for the window as a whole.
  useEffect(() => {
    if (!currentCave) {
      return
    }

    function onWindowDragEnter(event) {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }
      event.preventDefault()
      dragCounter.current += 1
      setDropzoneOpen(true)
    }

    function onWindowDragOver(event) {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
      }
    }

    function onWindowDragLeave() {
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setDropzoneOpen(false)
      }
    }

    function onWindowDrop() {
      dragCounter.current = 0
      setDropzoneOpen(false)
    }

    window.addEventListener('dragenter', onWindowDragEnter)
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('drop', onWindowDrop)

    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter)
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('dragleave', onWindowDragLeave)
      window.removeEventListener('drop', onWindowDrop)
    }
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
        <Dropzone
          open={dropzoneOpen}
          onDrop={() => {
            dragCounter.current = 0
            setDropzoneOpen(false)
          }}
        />
      </>
    )

  }

}