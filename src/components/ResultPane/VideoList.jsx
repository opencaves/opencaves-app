import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, TextField, Typography } from '@mui/material'
import { CloseRounded, DeleteOutlineRounded, EditRounded, PlayArrowRounded } from '@mui/icons-material'
import AddButton from '@/components/AddButton.jsx'
import { useTranslation } from 'react-i18next'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import { SCROLLBAR_STEP_FACTOR, SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import CaveModel from '@/models/CaveModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'

function getEmbedUrl(value) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') {
      return null
    }

    if (url.hostname === 'youtu.be' || ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      const videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v') || url.pathname.match(/^\/embed\/([^/]+)/)?.[1]
      return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null
    }

    if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
      const videoId = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }

    if (['facebook.com', 'www.facebook.com'].includes(url.hostname) && url.pathname === '/plugins/video.php') {
      return url.href
    }
  } catch {
    return null
  }

  return null
}

export default function VideoList({ caveId, videos, onChange, showTitle = true, showAdd = false, onAddUnauthorized, sx }) {
  const { t } = useTranslation('resultPane')
  const roles = useSelector((state) => state.session.roles)
  const scrollbarsRef = useRef()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const videoUrls = (Array.isArray(videos) ? videos : typeof videos === 'string' ? videos.split('|') : []).map((video) => video.trim()).filter(Boolean)
  const canEdit = roles.includes('editor')
  const videoWidth = ASSETS_LIST_CONFIG.height * ASSETS_LIST_CONFIG.widthRatio * 1.5
  const videoHeight = (videoWidth * 9) / 16

  function isValidVideoUrl(value) {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }

  function closeAddDialog() {
    setAddDialogOpen(false)
    setNewVideoUrl('')
    setEditingIndex(null)
  }

  async function addVideo() {
    const nextVideos = [...videoUrls]
    if (editingIndex === null) {
      nextVideos.push(newVideoUrl.trim())
    } else {
      nextVideos[editingIndex] = newVideoUrl.trim()
    }
    if (onChange) {
      onChange(nextVideos)
      closeAddDialog()
      return
    }
    setSaving(true)
    try {
      await CaveModel.save(caveId, { videos: nextVideos })
      invalidateData()
      await getData()
      closeAddDialog()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const scrollbar = scrollbarsRef.current
    const container = scrollbar?.container
    if (!container) {
      return undefined
    }

    function onWheel(event) {
      event.preventDefault()
      const { scrollLeft, scrollWidth, clientWidth } = scrollbar.getValues()
      const maxScrollLeft = scrollWidth - clientWidth
      const delta = event.deltaY || event.deltaX
      const direction = Math.sign(delta)
      if (!direction || maxScrollLeft <= 0) {
        return
      }

      if ((direction < 0 && scrollLeft <= 0) || (direction > 0 && scrollLeft >= maxScrollLeft)) {
        return
      }

      scrollbar.scrollLeft(Math.max(0, Math.min(maxScrollLeft, scrollLeft + SCROLLBAR_STEP_FACTOR * direction)))
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [videoUrls.length])

  if (videoUrls.length === 0 && !canEdit && !showAdd) {
    return null
  }

  return (
    <Box sx={{ px: 'var(--oc-pane-padding-inline)', pt: 'var(--oc-pane-padding-block)', ...sx }}>
      {showTitle && (
        <Typography component="h2" className="h2" sx={{ mb: 1 }}>
          {t('videosHeader')}
        </Typography>
      )}
      {videoUrls.length > 0 && (
        <Box sx={{ height: `calc(var(--oc-pane-padding-block) + ${videoHeight}px)`, marginBottom: 'calc(var(--oc-pane-padding-block) * -1)' }}>
          <Scrollbars
            ref={scrollbarsRef}
            autoHide
            autoHeight
            autoHeightMax={videoHeight + 100}
            trackHorizontalProps={{
              style: {
                left: 'calc(var(--oc-pane-padding-inline) / 2)',
                right: 'calc(var(--oc-pane-padding-inline) / 2)',
                bottom: `calc((var(--oc-pane-padding-block) - ${SCROLLBAR_TRACK_HEIGHT}px) / 2)`,
              },
            }}
          >
            <Box sx={{ px: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: `${ASSETS_LIST_CONFIG.spacing}px` }}>
                {videoUrls.map((video, index) => {
                  const embedUrl = getEmbedUrl(video)
                  return (
                    <Box key={`${video}-${index}`} sx={{ position: 'relative', width: videoWidth, height: videoHeight, flex: '0 0 auto', bgcolor: 'common.black', overflow: 'hidden', borderRadius: '.5rem' }}>
                      {embedUrl ? (
                        <ButtonBase aria-label={t('playVideo', { index: index + 1 })} onClick={() => setActiveVideo({ url: embedUrl, index: index + 1 })} sx={{ display: 'block', position: 'relative', width: '100%', height: '100%', bgcolor: 'common.black' }}>
                          {/* The preview iframe ignores pointer input so wheel events reach the horizontal gallery. */}
                          <Box component="iframe" src={embedUrl} title={t('videoFrameTitle', { index: index + 1 })} loading="lazy" tabIndex={-1} sx={{ display: 'block', width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
                          <PlayArrowRounded sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.65)', borderRadius: '50%', fontSize: 48 }} />
                        </ButtonBase>
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
                          <Link href={video} target="_blank" rel="noreferrer" sx={{ color: 'common.white', textAlign: 'center' }}>
                            {t('openVideo', { index: index + 1 })}
                          </Link>
                        </Box>
                      )}
                      {onChange && (
                        <CardOptionsMenu
                          ariaLabel={t('edit.videoOptions')}
                          actions={[
                            {
                              label: t('edit.editVideo'),
                              icon: <EditRounded fontSize="small" />,
                              onClick: () => {
                                setEditingIndex(index)
                                setNewVideoUrl(video)
                                setAddDialogOpen(true)
                              },
                            },
                            { label: t('edit.removeVideo'), icon: <DeleteOutlineRounded fontSize="small" />, onClick: () => onChange(videoUrls.filter((_, videoIndex) => videoIndex !== index)), danger: true },
                          ]}
                        />
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Scrollbars>
        </Box>
      )}
      {(canEdit || showAdd) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: showTitle ? 'var(--oc-pane-padding-block)' : videoUrls.length > 0 ? 2 : 0 }}>
          <AddButton onClick={() => (canEdit ? setAddDialogOpen(true) : onAddUnauthorized?.())}>{t('addVideos')}</AddButton>
        </Box>
      )}
      <Dialog open={addDialogOpen} onClose={closeAddDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingIndex === null ? t('addVideoTitle') : t('edit.editVideo')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label={t('videoUrl')} placeholder="https://" value={newVideoUrl} onChange={(event) => setNewVideoUrl(event.target.value)} error={!!newVideoUrl && !isValidVideoUrl(newVideoUrl)} helperText={!!newVideoUrl && !isValidVideoUrl(newVideoUrl) ? t('invalidVideoUrl') : ' '} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddDialog} disabled={saving}>
            {t('edit.cancel')}
          </Button>
          <Button variant="contained" onClick={addVideo} disabled={saving || !isValidVideoUrl(newVideoUrl)}>
            {editingIndex === null ? t('addVideo') : t('edit.save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(activeVideo)} onClose={() => setActiveVideo(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {activeVideo && t('videoFrameTitle', { index: activeVideo.index })}
          <IconButton onClick={() => setActiveVideo(null)} aria-label={t('closeVideo')}>
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, aspectRatio: '16 / 9', bgcolor: 'common.black' }}>{activeVideo && <Box component="iframe" src={activeVideo.url} title={t('videoFrameTitle', { index: activeVideo.index })} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen sx={{ display: 'block', width: '100%', height: '100%', border: 0 }} />}</DialogContent>
      </Dialog>
    </Box>
  )
}
