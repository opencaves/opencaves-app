import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AddAPhotoOutlined, EditRounded } from '@mui/icons-material'
import { Box, Button, Tab, Tabs } from '@mui/material'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import MediaList from './MediaList.jsx'
import VideoList from './VideoList.jsx'
import CaveMapList from './CaveMapList.jsx'

export default function CaveMediaTabs({ caveId, videos, onVideosChange, maps, onMapsChange, isNew = false, standaloneUpload = false }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const tabId = useId()
  const [tab, setTab] = useState('pictures')
  const activeTab = isNew ? 'videos' : tab
  const addPicturesButton = <AddMediasButton component={<Button variant="outlined" size="small" startIcon={<AddAPhotoOutlined />} />}>{t('addPictures')}</AddMediasButton>

  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, nextTab) => setTab(nextTab)} aria-label={`${t('pictures')} / ${t('videos')} / ${t('maps')}`} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {!isNew && <Tab value="pictures" label={t('pictures')} id={`${tabId}-pictures-tab`} aria-controls={`${tabId}-pictures-panel`} />}
        <Tab value="videos" label={t('videos')} id={`${tabId}-videos-tab`} aria-controls={`${tabId}-videos-panel`} />
        <Tab value="maps" label={t('maps')} id={`${tabId}-maps-tab`} aria-controls={`${tabId}-maps-panel`} />
      </Tabs>
      {!isNew && (
        <Box role="tabpanel" id={`${tabId}-pictures-panel`} aria-labelledby={`${tabId}-pictures-tab`} hidden={activeTab !== 'pictures'} sx={{ display: activeTab === 'pictures' ? 'flex' : 'none', flexDirection: 'column', gap: 2, pt: 2 }}>
          <MediaList caveId={caveId} editable />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {standaloneUpload ? <AddMediasProvider caveId={caveId}>{addPicturesButton}</AddMediasProvider> : addPicturesButton}
            <Button component={Link} to={`/map/${caveId}/medias`} size="small" startIcon={<EditRounded />}>
              {t('managePictures')}
            </Button>
          </Box>
        </Box>
      )}
      <Box role="tabpanel" id={`${tabId}-videos-panel`} aria-labelledby={`${tabId}-videos-tab`} hidden={activeTab !== 'videos'} sx={{ display: activeTab === 'videos' ? 'block' : 'none', pt: 2 }}>
        <VideoList caveId={caveId} videos={videos} onChange={onVideosChange} showTitle={false} sx={{ px: 0, pt: 0 }} />
      </Box>
      <Box role="tabpanel" id={`${tabId}-maps-panel`} aria-labelledby={`${tabId}-maps-tab`} hidden={activeTab !== 'maps'} sx={{ display: activeTab === 'maps' ? 'block' : 'none', pt: 2 }}>
        <CaveMapList maps={maps} onChange={onMapsChange} />
      </Box>
    </Box>
  )
}
