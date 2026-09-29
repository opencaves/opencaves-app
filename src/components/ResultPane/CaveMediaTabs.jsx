import { useId } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AddAPhotoOutlined } from '@mui/icons-material'
import AddButton from '@/components/AddButton.jsx'
import { Box, Tab, Tabs } from '@mui/material'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { setCaveMediaTab } from '@/redux/slices/appSlice.jsx'
import MediaList from './MediaList.jsx'
import VideoList from './VideoList.jsx'
import CaveMapList from './CaveMapList.jsx'

// Which of the Pictures/Videos/Maps tabs was last open, per cave: kept in
// the app slice's Redux state rather than component state, since that slice
// is already persisted to sessionStorage (see redux/store.jsx) - reloading
// the same cave's pane comes back to the tab the person was on for free.
export default function CaveMediaTabs({ caveId, videos, onVideosChange, sistemaId, isNew = false, standaloneUpload = false, editable = true }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isEditor = useSelector((state) => state.session.roles.includes('editor'))
  const isAnonymous = useSelector((state) => state.session.isAnonymous)
  const tab = useSelector((state) => state.app.caveMediaTabByCaveId[caveId]) || 'pictures'
  const tabId = useId()
  const activeTab = isNew ? 'videos' : tab

  function handleTabChange(nextTab) {
    dispatch(setCaveMediaTab({ caveId, tab: nextTab }))
  }
  const addPicturesButton = <AddMediasButton component={<AddButton startIcon={<AddAPhotoOutlined />} />}>{t('addPictures')}</AddMediasButton>

  function requireLogin() {
    dispatch(setContinueUrl(buildContinueUrl(location)))
    navigate(isAnonymous ? '/signup' : '/login')
  }

  return (
    <Box sx={{ my: editable ? 0 : 'var(--oc-pane-padding-block)' }}>
      <Tabs value={activeTab} onChange={(_, nextTab) => handleTabChange(nextTab)} aria-label={`${t('pictures')} / ${t('videos')} / ${t('maps')}`} sx={{ borderBottom: 1, borderColor: 'divider', px: editable ? 0 : 'var(--oc-pane-padding-inline)' }}>
        {!isNew && <Tab value="pictures" label={t('pictures')} id={`${tabId}-pictures-tab`} aria-controls={`${tabId}-pictures-panel`} />}
        <Tab value="videos" label={t('videos')} id={`${tabId}-videos-tab`} aria-controls={`${tabId}-videos-panel`} />
        <Tab value="maps" label={t('maps')} id={`${tabId}-maps-tab`} aria-controls={`${tabId}-maps-panel`} />
      </Tabs>
      {!isNew && (
        <Box role="tabpanel" id={`${tabId}-pictures-panel`} aria-labelledby={`${tabId}-pictures-tab`} hidden={activeTab !== 'pictures'} sx={{ display: activeTab === 'pictures' ? 'flex' : 'none', flexDirection: 'column', gap: 2, pt: 2 }}>
          <MediaList caveId={caveId} editable={editable} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {!editable && !isEditor ? (
              <AddButton startIcon={<AddAPhotoOutlined />} onClick={requireLogin}>
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
        <VideoList caveId={caveId} videos={videos} onChange={editable ? onVideosChange : undefined} showAdd={!editable} onAddUnauthorized={requireLogin} showTitle={false} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)', pt: 0 }} />
      </Box>
      <Box role="tabpanel" id={`${tabId}-maps-panel`} aria-labelledby={`${tabId}-maps-tab`} hidden={activeTab !== 'maps'} sx={{ display: activeTab === 'maps' ? 'block' : 'none', pt: 2 }}>
        <CaveMapList caveId={caveId} sistemaId={sistemaId} canAdd={isEditor} onAddUnauthorized={requireLogin} returnTo={editable ? `/map/${caveId}/edit` : `/map/${caveId}`} />
      </Box>
    </Box>
  )
}
