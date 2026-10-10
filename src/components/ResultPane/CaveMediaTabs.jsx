import { useCallback, useId, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AddAPhotoRounded from '@mui/icons-material/AddAPhotoRounded'
import AddButton from '@/components/AddButton.jsx'
import { Box, Tab, Tabs } from '@mui/material'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { setCaveMediaTab } from '@/redux/slices/appSlice.jsx'
import MediaList from './MediaList.jsx'
import VideoList from './VideoList.jsx'
import CaveMapList from './CaveMapList.jsx'
import OfflineSaveHint from '@/components/Offline/OfflineSaveHint.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'

/**
 * Which of the Pictures/Videos/Maps tabs was last open, per cave: kept in
 * the app slice's Redux state rather than component state, since that slice
 * is already persisted to sessionStorage (see redux/store.jsx) - reloading
 * the same cave's pane comes back to the tab the person was on for free.
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

  function handleTabChange(nextTab) {
    dispatch(setCaveMediaTab({ caveId, tab: nextTab }))
  }
  const addPicturesButton = <AddMediasButton component={<AddButton startIcon={<AddAPhotoRounded />} />}>{t('addPictures')}</AddMediasButton>

  const requireLoginForPhotos = useRequireLogin('photos')
  const requireLoginForVideos = useRequireLogin('videos')
  const requireLoginForMaps = useRequireLogin('maps')

  return (
    <Box sx={{ my: editable ? 0 : 'var(--oc-pane-padding-block)' }}>
      {/* Offline, a cave not saved: what's missing, and how to keep it all. */}
      {!editable && !isNew && <OfflineSaveHint caveId={caveId} sx={{ mx: 'var(--oc-pane-padding-inline)' }} />}
      <Tabs value={activeTab} onChange={(_, nextTab) => handleTabChange(nextTab)} aria-label={`${t('pictures')} / ${t('videos')} / ${t('maps')}`} sx={{ borderBottom: 1, borderColor: 'divider', px: editable ? 0 : 'var(--oc-pane-padding-inline)' }}>
        {!isNew && <Tab value="pictures" label={t('pictures')} id={`${tabId}-pictures-tab`} aria-controls={`${tabId}-pictures-panel`} />}
        <Tab value="videos" label={t('videos')} id={`${tabId}-videos-tab`} aria-controls={`${tabId}-videos-panel`} />
        <Tab value="maps" label={t('maps')} id={`${tabId}-maps-tab`} aria-controls={`${tabId}-maps-panel`} />
      </Tabs>
      {!isNew && (
        <Box role="tabpanel" id={`${tabId}-pictures-panel`} aria-labelledby={`${tabId}-pictures-tab`} hidden={activeTab !== 'pictures'} sx={{ display: activeTab === 'pictures' ? 'flex' : 'none', flexDirection: 'column', gap: 2, pt: 2 }}>
          <MediaList caveId={caveId} editable={editable} photoPath={photoPath} />
          {/* Photos added offline, waiting to upload. */}
          <PendingUploadsStrip filter={pendingPhotosOf} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)' }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {!editable && !isEditor ? (
              <AddButton startIcon={<AddAPhotoRounded />} onClick={requireLoginForPhotos}>
                {t('addPictures')}
              </AddButton>
            ) : standaloneUpload ? (
              <AddMediasProvider caveId={caveId}>{addPicturesButton}</AddMediasProvider>
            ) : (
              addPicturesButton
            )}
          </Box>
        </Box>
      )}
      <Box role="tabpanel" id={`${tabId}-videos-panel`} aria-labelledby={`${tabId}-videos-tab`} hidden={activeTab !== 'videos'} sx={{ display: activeTab === 'videos' ? 'block' : 'none', pt: 2 }}>
        <VideoList caveId={caveId} videos={videos} onChange={editable ? onVideosChange : undefined} showAdd={!editable} onAddUnauthorized={requireLoginForVideos} showTitle={false} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)', pt: 0 }} />
      </Box>
      <Box role="tabpanel" id={`${tabId}-maps-panel`} aria-labelledby={`${tabId}-maps-tab`} hidden={activeTab !== 'maps'} sx={{ display: activeTab === 'maps' ? 'block' : 'none', pt: 2 }}>
        <CaveMapList caveId={caveId} sistemaId={sistemaId} canAdd={isEditor} onAddUnauthorized={requireLoginForMaps} returnTo={editable ? `/map/${caveId}/edit` : `/map/${caveId}`} mapPath={mapPath} />
      </Box>
    </Box>
  )
}
