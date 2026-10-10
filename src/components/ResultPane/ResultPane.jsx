import { Suspense, lazy, useContext, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Collapse } from '@mui/material'
import { TransitionGroup } from 'react-transition-group'
import ResultPaneLg from './ResultPaneLg.jsx'
import { ResultPaneExitContext } from './resultPaneExit.js'
import CurrentCaveDetailsHeader from './CurrentCaveDetailsHeader.jsx'
import CurrentCaveDetailsContent from './CurrentCaveDetailsContent.jsx'
import CurrentCaveDetailsContentEdit from './CurrentCaveDetailsContentEdit.jsx'
import Dropzone from '@/components/AddMedias/Dropzone.jsx'
import { getCaveById } from '@/models/Cave.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { PANE_INITIAL_BREAKPOINT } from '@/config/app.js'
import { setResultPaneSmCaveId, setResultPaneSmCurrentBreakpoint, setResultPaneSmOpen, toggleFilterMenu } from '@/redux/slices/appSlice.jsx'
import { setCurrentCave } from '@/redux/slices/mapSlice.jsx'
import CaveSeo from '@/components/Seo/CaveSeo.jsx'
import './ResultPane.scss'
import { useWindowFileDrop } from '@/hooks/useWindowFileDrop.jsx'

// Phones only, and it brings Ionic along (see utils/ionic.js).
const ResultPaneSm = lazy(() => import('./ResultPaneSm.jsx'))

// Once per page load: whether the phone sheet's restored breakpoint was
// kept or reset (the effect below).
let sheetRestoreChecked = false

export default function ResultPane() {
  const { t } = useTranslation('resultPane')
  const { t: tApp } = useTranslation('app')
  const { caveId } = useParams()
  const dispatch = useDispatch()
  const store = useStore()
  const navigate = useNavigate()
  // Closing (desktop, ResultPaneOutlet): the route is already the bare map,
  // so the pane keeps the address it had - the same content, edit form or
  // not, while it shrinks.
  const exiting = Boolean(useContext(ResultPaneExitContext))
  const currentLocation = useLocation()
  const lastLocationRef = useRef(currentLocation)
  if (!exiting) lastLocationRef.current = currentLocation
  const location = lastLocationRef.current
  const caves = useSelector((/** @type {RootState} */ state) => state.map.data)
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const isSmall = useSmall()
  const { setTitle } = useTitle()
  const [currentCave, _setCurrentCave] = useState(/** @type {Cave} */ (undefined))

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
    // Another cave: the sheet at its initial height. The first one after a
    // page load, if it's the cave the sheet was on: where it was (restored
    // with the app slice).
    const restoring = !sheetRestoreChecked && /** @type {RootState} */ (store.getState()).app.resultPaneSmCaveId === caveId
    sheetRestoreChecked = true
    if (!restoring) dispatch(setResultPaneSmCurrentBreakpoint(PANE_INITIAL_BREAKPOINT))
    dispatch(setResultPaneSmCaveId(caveId))
  }, [caveId, dispatch, isSmall, store])

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


  // Editing it (/map/:caveId/edit): "Edit …", like every edit page's title.
  const isEditingCave = location.pathname.endsWith('/edit')
  useEffect(() => {
    if (currentCave) {
      const title = t('title', { name: currentCave.name?.value || t('caveNameUnknown', { ns: 'map' }) })
      setTitle(isEditingCave ? tApp('editTitle', { title }) : title)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCave, t, tApp, isEditingCave])

  // Files dragged anywhere over the window, while a cave's details pane is
  // open: the full-screen drop zone (useWindowFileDrop).
  const [dropzoneOpen, closeDropzone] = useWindowFileDrop(Boolean(currentCave) && !exiting)

  if (currentCave) {
    // Guard against rendering, even briefly, before the redirect effect
    // above fires for a non-editor who navigated straight to the edit URL.
    const showEditContent = isEditMode && roles.includes('editor')
    const DetailsContent = showEditContent ? CurrentCaveDetailsContentEdit : CurrentCaveDetailsContent

    return (
      <>
        {!exiting && <CaveSeo cave={currentCave} />}
        {
          isSmall ? (
            <TransitionGroup>
              <Collapse in={!!currentCave}>
                <Suspense fallback={null}>
                  <ResultPaneSm id="result-pane" cave={currentCave}>
                    {!showEditContent && <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>}
                    <DetailsContent key={currentCave.id} cave={currentCave}></DetailsContent>
                  </ResultPaneSm>
                </Suspense>
              </Collapse>
            </TransitionGroup>
          ) : (
            // It animates its own height: opening, closing, content changes.
            <ResultPaneLg id="result-pane" cave={currentCave} editMode={showEditContent}>
              {!showEditContent && <CurrentCaveDetailsHeader cave={currentCave}></CurrentCaveDetailsHeader>}
              <DetailsContent key={currentCave.id} cave={currentCave}></DetailsContent>
            </ResultPaneLg>
          )
        }
        <Outlet />
        <Dropzone open={dropzoneOpen} onDrop={closeDropzone} />
      </>
    )

  }

}