import { cloneElement, useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AddAPhotoRounded from '@mui/icons-material/AddAPhotoRounded'
import AddButton from '@/components/AddButton.jsx'
import { Box, Tab, Tabs, useTheme } from '@mui/material'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { setCaveMediaTab } from '@/redux/slices/appSlice.jsx'
import MediaList from './MediaList.jsx'
import VideoList from './VideoList.jsx'
import CaveMapList from './CaveMapList.jsx'
import OfflineSaveHint from '@/components/Offline/OfflineSaveHint.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'

// How far the panels slide (M3's shared axis X: 30dp).
const SHARED_AXIS_SHIFT = 30

/**
 * M3's shared axis X between tab panels, on a change of `activeTab`: the
 * outgoing panel fades and slides away (emphasized accelerate), the incoming
 * one comes in from the other side (emphasized decelerate), the way the tabs
 * moved; the panels' container glides from the old height to the new one.
 * Nothing for reduced motion. Call `beforeChange` before changing the tab:
 * it takes the height the glide starts from.
 *
 * @param {import('react').RefObject<HTMLElement>} containerRef - The panels' container.
 * @param {string} activeTab
 * @param {string[]} order - The tabs, in their order.
 * @param {(tab: string) => HTMLElement | null} panelOf - A tab's panel.
 * @returns {() => void} beforeChange.
 */
function useSharedAxisX(containerRef, activeTab, order, panelOf) {
  const theme = useTheme()
  const previous = useRef(activeTab)
  const fromHeight = useRef(/** @type {number|null} */ (null))
  const running = useRef(/** @type {Array<() => void>} */ ([]))

  useLayoutEffect(() => {
    const from = previous.current
    previous.current = activeTab
    const startHeight = fromHeight.current
    fromHeight.current = null
    const container = containerRef.current
    if (from === activeTab || startHeight == null || !container) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // One switch at a time: a quick second click ends the first at once.
    running.current.forEach((end) => end())
    running.current = []
    const outgoing = panelOf(from)
    const incoming = panelOf(activeTab)
    if (!outgoing || !incoming || typeof container.animate !== 'function') return
    const { duration } = theme.oc.sys.motion
    const { easing } = theme.sys.motion
    const way = order.indexOf(activeTab) > order.indexOf(from) ? 1 : -1

    // The outgoing panel, still drawn over the new one while it leaves.
    Object.assign(outgoing.style, { display: outgoing.id.endsWith('pictures-panel') ? 'flex' : 'block', position: 'absolute', top: '0', left: '0', right: '0', pointerEvents: 'none' })
    const leave = outgoing.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-way * SHARED_AXIS_SHIFT}px)` }], { duration: duration.emphasizedAccelerate, easing: easing.emphasizedAccelerate, fill: 'forwards' })
    const enter = incoming.animate([{ opacity: 0, transform: `translateX(${way * SHARED_AXIS_SHIFT}px)` }, { opacity: 1, transform: 'none' }], { duration: duration.emphasizedDecelerate, delay: duration.emphasizedAccelerate / 2, easing: easing.emphasizedDecelerate, fill: 'backwards' })
    // The height, from the old panel's to the new one's (clipped meanwhile).
    const endHeight = container.offsetHeight
    const grow = endHeight !== startHeight ? container.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], { duration: duration.emphasizedDecelerate, easing: easing.emphasizedDecelerate }) : null
    if (grow) container.style.overflow = 'clip'
    const endLeave = () => {
      leave.cancel()
      for (const key of ['display', 'position', 'top', 'left', 'right', 'pointerEvents']) outgoing.style.removeProperty(key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
    }
    const endGrow = () => {
      grow?.cancel()
      container.style.removeProperty('overflow')
    }
    leave.finished.then(endLeave, () => {})
    grow?.finished.then(endGrow, () => {})
    running.current = [endLeave, () => enter.finish(), endGrow]
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  return () => {
    fromHeight.current = containerRef.current?.offsetHeight ?? null
  }
}

/**
 * Which of the Pictures/Videos/Maps tabs was last open, per cave: kept in
 * the app slice's Redux state rather than component state, since that slice
 * is already persisted to sessionStorage (see redux/store.jsx) - reloading
 * the same cave's pane comes back to the tab the person was on for free.
 * Switching tabs is M3's shared axis X ({@link useSharedAxisX}): the panels
 * slide the tabs' way, the height between them glides.
 *
 * @param {object} props
 * @param {string} props.caveId
 * @param {string[] | string} [props.videos] - Their URLs (VideoList's).
 * @param {(videos: string[]) => void} [props.onVideosChange]
 * @param {string} [props.sistemaId]
 * @param {boolean} [props.isNew=false] - A cave not created yet: no photos tab.
 * @param {boolean} [props.standaloneUpload=false] - Its own upload provider (outside the media pane).
 * @param {boolean} [props.editable=true]
 * @param {string} [props.galleryPath] - The page whose galleries open its photos and maps (the cave's
 *   edit page: <galleryPath>/photos/:id, /maps/:id); the map's viewers otherwise.
 */
export default function CaveMediaTabs({ caveId, videos, onVideosChange, sistemaId, isNew = false, standaloneUpload = false, editable = true, galleryPath }) {
  // Stable: the photo list rebuilds when its photoPath changes.
  const photoPath = useMemo(() => galleryPath && ((id) => `${galleryPath}/photos/${id}`), [galleryPath])
  const mapPath = useMemo(() => galleryPath && ((id) => `${galleryPath}/maps/${id}`), [galleryPath])
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const dispatch = useDispatch()
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles.includes('editor'))
  const tab = useSelector((/** @type {RootState} */ state) => state.app.caveMediaTabByCaveId[caveId]) || 'pictures'
  const tabId = useId()
  const activeTab = isNew ? 'videos' : tab
  const pendingPhotosOf = useCallback((item) => item.kind === 'photo' && item.caveId === caveId, [caveId])
  const panelsRef = useRef(null)
  const tabOrder = isNew ? ['videos', 'maps'] : ['pictures', 'videos', 'maps']
  const beforeTabChange = useSharedAxisX(panelsRef, activeTab, tabOrder, (name) => document.getElementById(`${tabId}-${name}-panel`))

  function handleTabChange(nextTab) {
    beforeTabChange()
    dispatch(setCaveMediaTab({ caveId, tab: nextTab }))
  }
  const requireLoginForPhotos = useRequireLogin('photos')

  // Adding photos, a button under the strip at all times (as the videos' and
  // the maps'): the file picker - in its own provider for a standalone
  // upload - or, for a visitor, signing in.
  function addPictures(look) {
    if (!editable && !isEditor) {
      return cloneElement(look, { onClick: requireLoginForPhotos })
    }
    const button = <AddMediasButton component={look} />
    return standaloneUpload ? <AddMediasProvider caveId={caveId}>{button}</AddMediasProvider> : button
  }
  const addPicturesButton = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
      {addPictures(<AddButton startIcon={<AddAPhotoRounded />}>{t('addPictures')}</AddButton>)}
    </Box>
  )
  const requireLoginForVideos = useRequireLogin('videos')
  const requireLoginForMaps = useRequireLogin('maps')

  return (
    <Box className="oc-cave-media-tabs" sx={{ my: editable ? 0 : 'var(--oc-pane-padding-block)' }}>
      {/* Offline, a cave not saved: what's missing, and how to keep it all. */}
      {!editable && !isNew && <OfflineSaveHint caveId={caveId} sx={{ mx: 'var(--oc-pane-padding-inline)' }} />}
      <Tabs value={activeTab} onChange={(_, nextTab) => handleTabChange(nextTab)} aria-label={`${t('pictures')} / ${t('videos')} / ${t('maps')}`} sx={{ borderBottom: 1, borderColor: 'divider', px: editable ? 0 : 'var(--oc-pane-padding-inline)' }}>
        {!isNew && <Tab value="pictures" label={t('pictures')} id={`${tabId}-pictures-tab`} aria-controls={`${tabId}-pictures-panel`} />}
        <Tab value="videos" label={t('videos')} id={`${tabId}-videos-tab`} aria-controls={`${tabId}-videos-panel`} />
        <Tab value="maps" label={t('maps')} id={`${tabId}-maps-tab`} aria-controls={`${tabId}-maps-panel`} />
      </Tabs>
      {/* The panels: one shown, the others there (their strips built once shown). */}
      <Box ref={panelsRef} className="oc-cave-media-tabs--panels" sx={{ position: 'relative' }}>
        {!isNew && (
          <Box role="tabpanel" id={`${tabId}-pictures-panel`} aria-labelledby={`${tabId}-pictures-tab`} hidden={activeTab !== 'pictures'} sx={{ display: activeTab === 'pictures' ? 'flex' : 'none', flexDirection: 'column', gap: 2, pt: 2 }}>
            <MediaList caveId={caveId} editable={editable} photoPath={photoPath} />
            {/* Photos added offline, waiting to upload. */}
            <PendingUploadsStrip filter={pendingPhotosOf} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)' }} />
            {addPicturesButton}
          </Box>
        )}
        <Box role="tabpanel" id={`${tabId}-videos-panel`} aria-labelledby={`${tabId}-videos-tab`} hidden={activeTab !== 'videos'} sx={{ display: activeTab === 'videos' ? 'block' : 'none', pt: 2 }}>
          <VideoList caveId={caveId} videos={videos} onChange={editable ? onVideosChange : undefined} showAdd={!editable} onAddUnauthorized={requireLoginForVideos} showTitle={false} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)', pt: 0 }} />
        </Box>
        <Box role="tabpanel" id={`${tabId}-maps-panel`} aria-labelledby={`${tabId}-maps-tab`} hidden={activeTab !== 'maps'} sx={{ display: activeTab === 'maps' ? 'block' : 'none', pt: 2 }}>
          <CaveMapList caveId={caveId} sistemaId={sistemaId} canAdd={isEditor} onAddUnauthorized={requireLoginForMaps} returnTo={editable ? `/map/${caveId}/edit` : `/map/${caveId}`} mapPath={mapPath} />
        </Box>
      </Box>
    </Box>
  )
}
