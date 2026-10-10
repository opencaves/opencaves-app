import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Link, TextField, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import AddButton from '@/components/AddButton.jsx'
import { useTranslation } from 'react-i18next'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import { centerFocused, centerItem, leaveOnArrow, scrollStrip, snapOnSettle } from '@/utils/mediaStrip.js'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { SCROLLBAR_TRACK_HEIGHT } from '@/config/app.js'
import CaveModel from '@/models/CaveModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { videoSiteName, youtubeThumbnail } from '@/utils/videos.js'

// The video sites the player can show: YouTube, Vimeo and Facebook. A link
// from anywhere else is refused by the Add video form.
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
const FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com']

// A video link as pasted from the site (its Share button or the address bar)
// -> the address of its embedded player, or null when it isn't a video from
// one of those sites.
function getEmbedUrl(value) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') {
      return null
    }

    if (url.hostname === 'youtu.be' || YOUTUBE_HOSTS.includes(url.hostname)) {
      const videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
      return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null
    }

    if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
      const videoId = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }

    if (FACEBOOK_HOSTS.includes(url.hostname) && url.pathname === '/plugins/video.php') {
      return url.href
    }

    // A video's own page (.../videos/123, /watch?v=123, /reel/123, or its
    // fb.watch short link) plays in Facebook's embedded player.
    const isFacebookVideo = (FACEBOOK_HOSTS.includes(url.hostname) && (/\/videos\/\d+/.test(url.pathname) || /^\/reel\/\d+/.test(url.pathname) || (url.pathname.startsWith('/watch') && url.searchParams.get('v')))) || (url.hostname === 'fb.watch' && url.pathname.length > 1)
    if (isFacebookVideo) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}`
    }
  } catch {
    return null
  }

  return null
}

// A video's width in the strip: narrower than the pane's (about 352 px
// inside its padding), so the next video shows beside it - a sign there are
// more. 16:9.
const VIDEO_WIDTH = 280

export default function VideoList({ caveId, videos, onChange, showTitle = true, showAdd = false, onAddUnauthorized, sx }) {
  const { t } = useTranslation('resultPane')
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const settleWrite = useSettleWrite()
  const [openSnackbar] = useSnackbar()
  // A video just added: scrolled to once drawn (it goes at the strip's end).
  const [shownIndex, setShownIndex] = useState(null)
  // For the offline save's messages.
  const caveName = useSelector((/** @type {RootState} */ state) => state.data.caves.find((cave) => cave.id === caveId)?.name?.value) || ''
  const scrollbarsRef = useRef()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  const [videoToDelete, setVideoToDelete] = useState(null)
  const videoUrls = (Array.isArray(videos) ? videos : typeof videos === 'string' ? videos.split('|') : []).map((video) => video.trim()).filter(Boolean)
  const canEdit = roles.includes('editor') || roles.includes('admin')
  // Deleting a video: admins only.
  const canDelete = roles.includes('admin')
  const videoWidth = VIDEO_WIDTH
  const videoHeight = (videoWidth * 9) / 16
  // Narrower where the place it's in says so (--oc-video-max-width, e.g. a
  // card on a phone), keeping its 16:9 shape.
  const shownWidth = `min(${videoWidth}px, var(--oc-video-max-width, ${videoWidth}px))`
  const shownHeight = `calc(${shownWidth} * 9 / 16)`

  // Only links the player can show (getEmbedUrl).
  function isValidVideoUrl(value) {
    return getEmbedUrl(value) !== null
  }

  // Already in the list, in any of its link's forms (youtu.be or watch?v=,
  // with or without www): the same player address. Not the one being edited.
  function isListedVideo(value) {
    const embedUrl = getEmbedUrl(value)
    return embedUrl !== null && videoUrls.some((video, index) => index !== editingIndex && getEmbedUrl(video) === embedUrl)
  }

  useEffect(() => {
    if (shownIndex === null) return undefined
    // Once drawn: the list grows when the app's data has refreshed.
    const frame = requestAnimationFrame(() => {
      const view = scrollbarsRef.current?.view
      const item = view?.querySelectorAll('.oc-video-list--item')[shownIndex]
      if (!item) return
      centerItem(view, item)
      setShownIndex(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [shownIndex, videoUrls.length])

  function closeAddDialog() {
    setAddDialogOpen(false)
    setNewVideoUrl('')
    setEditingIndex(null)
  }

  // In an edit form (onChange), the form saves the videos with the rest;
  // on the cave's page, they're saved at once.
  async function saveVideos(nextVideos) {
    if (onChange) {
      onChange(nextVideos)
      return 'form'
    }
    // Offline, kept on the device and synced later (useSettleWrite).
    const status = await settleWrite(CaveModel.save(caveId, { videos: nextVideos }), { name: caveName })
    // The app's data refreshed in the background: waiting for it (a full
    // reload) kept the dialog open for seconds after the save was done.
    invalidateData()
    getData().catch((error) => console.warn(error))
    return status
  }

  async function addVideo() {
    const nextVideos = [...videoUrls]
    if (editingIndex === null) {
      nextVideos.push(newVideoUrl.trim())
    } else {
      nextVideos[editingIndex] = newVideoUrl.trim()
    }
    const adding = editingIndex === null
    // Closed at once: the list shows the change straight away (Firestore's
    // local write), the server's confirmation takes seconds. A new video goes
    // at the strip's end, out of sight: scrolled to. Said once confirmed
    // (saved offline: useSettleWrite says so); failed, Firestore takes it
    // back out and the snackbar says so.
    closeAddDialog()
    if (adding) setShownIndex(nextVideos.length - 1)
    try {
      const status = await saveVideos(nextVideos)
      if (adding && status === 'saved') openSnackbar(t('videoAdded'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('videoAddError'), { severity: 'error' })
    }
  }

  // In an edit form, removed at once (the form's Save applies it); on the
  // cave's page, after a confirmation, since it's saved right away.
  function requestDelete(index) {
    if (onChange) {
      onChange(videoUrls.filter((_, videoIndex) => videoIndex !== index))
      return
    }
    setVideoToDelete(index)
  }

  function closeDeleteDialog() {
    setVideoToDelete(null)
  }

  // Closed at once, as adding (the list shows it gone straight away); said
  // either way in a snackbar once the server answers (saved offline,
  // useSettleWrite says so).
  async function confirmDelete() {
    const nextVideos = videoUrls.filter((_, videoIndex) => videoIndex !== videoToDelete)
    setVideoToDelete(null)
    try {
      const status = await saveVideos(nextVideos)
      if (status === 'saved') openSnackbar(t('videoDeleted'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('edit.deleteVideoError'), { severity: 'error' })
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

      scrollStrip(scrollbar.view, event)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    const stopSnapping = snapOnSettle(scrollbar.view, container)
    return () => {
      container.removeEventListener('wheel', onWheel)
      stopSnapping()
    }
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
        <Box className="oc-media-strip" sx={{ height: `calc(var(--oc-pane-padding-block) + ${shownHeight})`, marginBottom: 'calc(var(--oc-pane-padding-block) * -1)' }}>
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
            <Box onFocus={(event) => centerFocused(event, scrollbarsRef.current?.view)} onKeyDown={leaveOnArrow} sx={{ px: 'var(--oc-pane-padding-inline)', mb: 'var(--oc-pane-padding-block)', width: 'fit-content' }}>
              <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: `${ASSETS_LIST_CONFIG.spacing}px` }}>
                {videoUrls.map((video, index) => {
                  const embedUrl = getEmbedUrl(video)
                  return (
                    <Box key={`${video}-${index}`} className="oc-video-list--item oc-media-strip--item" sx={{ position: 'relative', width: shownWidth, height: shownHeight, flex: '0 0 auto', bgcolor: 'common.black', overflow: 'hidden', borderRadius: '.5rem' }}>
                      {embedUrl ? (
                        <ButtonBase aria-label={t('playVideo', { index: index + 1 })} onClick={() => setActiveVideo({ url: embedUrl, index: index + 1 })} sx={{ display: 'block', position: 'relative', width: '100%', height: '100%', bgcolor: 'common.black' }}>
                          {/* A still, not the site's player: the players loaded ~1.9MB of
                              script per page before anyone pressed play. The player opens in
                              the dialog. A YouTube video's thumbnail; other sites' have none,
                              so their name. */}
                          {youtubeThumbnail(video) ? (
                            <Box component="img" src={youtubeThumbnail(video, 'hqdefault')} alt="" loading="lazy" sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Typography component="span" variant="caption" sx={{ position: 'absolute', left: 12, bottom: 8, color: 'common.white', opacity: 0.8 }}>
                              {videoSiteName(video)}
                            </Typography>
                          )}
                          <PlayArrowRounded sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.65)', borderRadius: '50%', fontSize: 48 }} />
                        </ButtonBase>
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
                          <Link href={video} target="_blank" rel="noreferrer" sx={{ color: 'common.white', textAlign: 'center' }}>
                            {t('openVideo', { index: index + 1 })}
                          </Link>
                        </Box>
                      )}
                      {canEdit && (
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
                            canDelete && { label: t('edit.deleteVideo'), icon: <DeleteOutlineRounded fontSize="small" />, onClick: () => requestDelete(index), danger: true },
                          ].filter(Boolean)}
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
          <DialogContentText sx={{ mb: 2 }}>{t('videoUrlHelp')}</DialogContentText>
          <TextField autoFocus fullWidth label={t('videoUrl')} placeholder="https://" value={newVideoUrl} onChange={(event) => setNewVideoUrl(event.target.value)} error={!!newVideoUrl.trim() && (!isValidVideoUrl(newVideoUrl) || isListedVideo(newVideoUrl))} helperText={!newVideoUrl.trim() ? ' ' : !isValidVideoUrl(newVideoUrl) ? t('invalidVideoUrl') : isListedVideo(newVideoUrl) ? t('videoAlreadyAdded') : ' '} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddDialog}>
            {t('edit.cancel')}
          </Button>
          <Button variant="contained" onClick={addVideo} disabled={!isValidVideoUrl(newVideoUrl) || isListedVideo(newVideoUrl)}>
            {editingIndex === null ? t('addVideo') : t('edit.save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog className="oc-delete-video-dialog" open={videoToDelete !== null} onClose={closeDeleteDialog}>
        <DialogTitle>{t('edit.deleteVideo')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('edit.deleteVideoConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>
            {t('edit.cancel')}
          </Button>
          <Button color="error" onClick={confirmDelete}>
            {t('edit.delete')}
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
