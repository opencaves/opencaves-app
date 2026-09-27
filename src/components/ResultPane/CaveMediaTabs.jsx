import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AddAPhotoOutlined, EditRounded } from '@mui/icons-material'
import { Box, Button, Tab, Tabs } from '@mui/material'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import CaveModel from '@/models/CaveModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import MediaList from './MediaList.jsx'
import VideoList from './VideoList.jsx'
import CaveMapList from './CaveMapList.jsx'

export default function CaveMediaTabs({ caveId, videos, onVideosChange, maps, onMapsChange, isNew = false, standaloneUpload = false, editable = true }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isEditor = useSelector((state) => state.session.roles.includes('editor'))
  const isAnonymous = useSelector((state) => state.session.isAnonymous)
  const tabId = useId()
  const [tab, setTab] = useState('pictures')
  const activeTab = isNew ? 'videos' : tab
  const addPicturesButton = <AddMediasButton component={<Button variant="outlined" size="small" startIcon={<AddAPhotoOutlined />} />}>{t('addPictures')}</AddMediasButton>

  function requireLogin() {
    dispatch(setContinueUrl(buildContinueUrl(location)))
    navigate(isAnonymous ? '/signup' : '/login')
  }

  async function addMaps(nextMaps) {
    await CaveModel.save(caveId, { maps: nextMaps })
    invalidateData()
    await getData()
  }

  return (
    <Box sx={{ my: editable ? 0 : 'var(--oc-pane-padding-block)' }}>
      <Tabs value={activeTab} onChange={(_, nextTab) => setTab(nextTab)} aria-label={`${t('pictures')} / ${t('videos')} / ${t('maps')}`} sx={{ borderBottom: 1, borderColor: 'divider', px: editable ? 0 : 'var(--oc-pane-padding-inline)' }}>
        {!isNew && <Tab value="pictures" label={t('pictures')} id={`${tabId}-pictures-tab`} aria-controls={`${tabId}-pictures-panel`} />}
        <Tab value="videos" label={t('videos')} id={`${tabId}-videos-tab`} aria-controls={`${tabId}-videos-panel`} />
        <Tab value="maps" label={t('maps')} id={`${tabId}-maps-tab`} aria-controls={`${tabId}-maps-panel`} />
      </Tabs>
      {!isNew && (
        <Box role="tabpanel" id={`${tabId}-pictures-panel`} aria-labelledby={`${tabId}-pictures-tab`} hidden={activeTab !== 'pictures'} sx={{ display: activeTab === 'pictures' ? 'flex' : 'none', flexDirection: 'column', gap: 2, pt: 2 }}>
          <MediaList caveId={caveId} editable={editable} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {!editable && !isEditor ? (
              <Button variant="outlined" size="small" startIcon={<AddAPhotoOutlined />} onClick={requireLogin}>
                {t('addPictures')}
              </Button>
            ) : standaloneUpload ? (
              <AddMediasProvider caveId={caveId}>{addPicturesButton}</AddMediasProvider>
            ) : (
              addPicturesButton
            )}
            {editable && (
              <Button component={Link} to={`/map/${caveId}/medias`} size="small" startIcon={<EditRounded />}>
                {t('managePictures')}
              </Button>
            )}
          </Box>
        </Box>
      )}
      <Box role="tabpanel" id={`${tabId}-videos-panel`} aria-labelledby={`${tabId}-videos-tab`} hidden={activeTab !== 'videos'} sx={{ display: activeTab === 'videos' ? 'block' : 'none', pt: 2 }}>
        <VideoList caveId={caveId} videos={videos} onChange={editable ? onVideosChange : undefined} showAdd={!editable} onAddUnauthorized={requireLogin} showTitle={false} sx={{ px: editable ? 0 : 'var(--oc-pane-padding-inline)', pt: 0 }} />
      </Box>
      <Box role="tabpanel" id={`${tabId}-maps-panel`} aria-labelledby={`${tabId}-maps-tab`} hidden={activeTab !== 'maps'} sx={{ display: activeTab === 'maps' ? 'block' : 'none', pt: 2 }}>
        <CaveMapList maps={maps} onChange={editable ? onMapsChange : undefined} onAdd={editable ? undefined : addMaps} canAdd={editable || isEditor} onAddUnauthorized={requireLogin} />
      </Box>
    </Box>
  )
}
