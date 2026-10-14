import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTheme } from '@mui/material/styles'
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Link, TextField, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import AddButton from '@/components/AddButton.jsx'
import { useTranslation } from 'react-i18next'
import { centerItem } from '@/utils/mediaStrip.js'
import MediaStrip from './MediaStrip.jsx'
import StripShowAll from './StripShowAll.jsx'
import CardOptionsMenu from './CardOptionsMenu.jsx'
import { useMediaActionsFor, withOthers } from '@/components/MediaPane/menuItems/mediaActions.jsx'
import { ASSETS_LIST_CONFIG } from '@/config/resultPane.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import CaveModel from '@/models/CaveModel.js'
import { invalidateData, getData } from '@/services/data-service.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { videoSiteName, youtubeThumbnail } from '@/utils/videos.js'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useReorder } from '@/hooks/useReorder.js'

// The video sites the player can show: YouTube, Vimeo and Facebook. A link
// from anywhere else is refused by the Add video form.
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
const FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com']

// A video link as pasted from the site (its Share button or the address bar)
// -> the address of its embedded player, or null when it isn't a video from
// one of those sites.
/**
 * A player's address set to start playing as it opens (the dialog opens on
 * a tap, so browsers usually let it play with sound; some phones still wait
 * for the play button).
 *
 * @param {string} embedUrl - From {@link getEmbedUrl}.
 * @returns {string}
 */
function autoplayUrl(embedUrl) {
  const url = new URL(embedUrl)
  if (url.hostname.includes('facebook.com')) url.searchParams.set('autoplay', 'true')
  else {
    url.searchParams.set('autoplay', '1')
    // YouTube on an iPhone: in the page, not its own full-screen player.
    url.searchParams.set('playsinline', '1')
  }
  return url.href
}

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

/**
 * A cave's videos (YouTube and Facebook links), in a strip; editable when it
 * has an onChange.
 *
 * @param {object} props
 * @param {string} props.caveId
 * @param {string[] | string} [props.videos] - Their URLs (a string: separated by "|").
 * @param {(videos: string[]) => void} [props.onChange] - Given the new list (one added or removed).
 * @param {boolean} [props.showTitle=true]
 * @param {boolean} [props.showAdd=false] - An Add button even without onChange (it asks to log in).
 * @param {() => void} [props.onAddUnauthorized] - That Add button's click.
 * @param {'center'|'start'} [props.start='center'] - Where its first video is at first ({@link MediaStrip}'s).
 * @param {boolean} [props.fill=false] - The strip's cylinder across its whole width ({@link MediaStrip}'s).
 * @param {boolean} [props.showAll=false] - Show all under the strip ({@link StripShowAll}): every video in a grid.
 * @param {Sx} [props.sx]
 */
export default function VideoList({ caveId, videos, onChange, showTitle = true, showAdd = false, onAddUnauthorized, start = 'center', fill = false, showAll = false, sx }) {
  const { t } = useTranslation('resultPane')
  const roles = useSelector((/** @type {RootState} */ state) => state.session.roles)
  const settleWrite = useSettleWrite()
  const [openSnackbar] = useSnackbar()
  // A video just added: scrolled to once drawn (it goes at the strip's end).
  const [shownIndex, setShownIndex] = useState(null)
  // For the offline save's messages.
  const caveName = useSelector((/** @type {RootState} */ state) => state.data.caves.find((cave) => cave.id === caveId)?.name?.value) || ''
  const scrollbarsRef = useRef(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  // On a phone, the player full screen (a back arrow, as every full-screen
  // view) - turned sideways too: narrow, or short (a phone in landscape is
  // wider than the phone breakpoint, but under 500px tall).
  const isPhone = useSmall('(max-width: 599.95px), (max-height: 499.95px)')
  // The full-screen player opens out of its card and closes back into it
  // (MD3's container transform); not for reduced motion.
  const playerRef = useRef(null)
  const playerContentRef = useRef(null)
  const playerClosing = useRef(false)
  const { motion } = useTheme().sys
  const transform = isPhone && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /**
   * The container transform, one way: the player's frame between its card's
   * box and the whole screen, its content fading in once it's grown (out
   * first, going back). MD3's emphasized easing - decelerating in, long;
   * accelerating out, shorter (the theme's motion tokens). Without the card on
   * screen, a fade.
   *
   * @param {boolean} opening
   * @returns {Animation[]}
   */
  function animatePlayer(opening) {
    const paper = playerRef.current
    const content = playerContentRef.current
    if (!paper || !content) return []
    // The other way's, if still on them.
    for (const element of [paper, content]) element.getAnimations().forEach((animation) => animation.cancel())
    const card = activeVideo?.from?.isConnected ? activeVideo.from.getBoundingClientRect() : null
    const curve = opening ? 'emphasizedDecelerate' : 'emphasizedAccelerate'
    const timing = { duration: motion.duration[curve], easing: motion.easing[curve], fill: /** @type {FillMode} */ ('both') }
    if (!card?.width) return [paper.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: motion.duration.standardAccelerate })]
    // Its part on the screen (a card half past the edge, its visible part).
    const edge = (value) => Math.max(0, value)
    const cardBox = `inset(${edge(card.top)}px ${edge(window.innerWidth - card.right)}px ${edge(window.innerHeight - card.bottom)}px ${edge(card.left)}px round 8px)`
    const screenBox = 'inset(0px 0px 0px 0px round 0px)'
    return [
      paper.animate(opening ? [{ clipPath: cardBox }, { clipPath: screenBox }] : [{ clipPath: screenBox }, { clipPath: cardBox }], timing),
      content.animate(opening ? [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], { ...timing, easing: 'linear' }),
    ]
  }

  function closePlayer() {
    if (!transform) return setActiveVideo(null)
    if (playerClosing.current) return undefined
    playerClosing.current = true
    Promise.all(animatePlayer(false).map((animation) => animation.finished.catch(() => {}))).then(() => {
      playerClosing.current = false
      setActiveVideo(null)
    })
    return undefined
  }
  const [videoToDelete, setVideoToDelete] = useState(null)
  const savedUrls = (Array.isArray(videos) ? videos : typeof videos === 'string' ? videos.split('|') : []).map((video) => video.trim()).filter(Boolean)
  // Editors reorder them in Show all: the array's order is theirs (saved at
  // once, or, in an edit form, handed to it).
  const [videoUrls, reorderVideos] = useReorder(savedUrls, async (next) => (onChange ? onChange(next) : CaveModel.save(caveId, { videos: next })), { name: caveName })
  const canEdit = roles.includes('editor') || roles.includes('admin')
  // Each video once: the order is kept by URL.
  const sortableVideos = canEdit && new Set(videoUrls).size === videoUrls.length
  // Deleting a video: admins only.
  const canDelete = roles.includes('admin')
  const mediaActionsFor = useMediaActionsFor()
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

  // A video's still: plays in the player dialog, or a link to it.
  function videoStill(video, index) {
    const embedUrl = getEmbedUrl(video)
    return (
      embedUrl ? (
        <ButtonBase aria-label={t('playVideo', { index: index + 1 })} onClick={(event) => setActiveVideo({ url: embedUrl, index: index + 1, from: event.currentTarget })} sx={{ display: 'block', position: 'relative', width: '100%', height: '100%', bgcolor: 'common.black' }}>
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
          {/* Its see-through circle: drawn apart on the 3D strip (MediaStrip's oc-media-strip--translucent). */}
          <PlayArrowRounded className="oc-media-strip--translucent" sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.65)', borderRadius: '50%', fontSize: 48 }} />
        </ButtonBase>
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
          <Link href={video} target="_blank" rel="noreferrer" sx={{ color: 'common.white', textAlign: 'center' }}>
            {t('openVideo', { index: index + 1 })}
          </Link>
        </Box>
      )
    )
  }

  // A video's own actions (editors): edit its address; delete it (admins).
  const videoActions = (video, index) => [
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
  ].filter(Boolean)

  // Its menu, for everyone: Share (its own link) and Report this video -
  // no Download, a video is someone else's site's - then its own actions.
  const videoMenu = (video, index) => withOthers(mediaActionsFor({ kind: 'video', shareUrl: video, reportPage: video }), canEdit ? videoActions(video, index) : [])

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
        <MediaStrip start={start} fill={fill} className="oc-video-list--strip" itemHeight={videoHeight} height={shownHeight} gap={ASSETS_LIST_CONFIG.spacing} rebuildKey={videoUrls.join(' ')} scrollbarsRef={scrollbarsRef}>
                {videoUrls.map((video, index) => {
                  return (
                    <Box key={`${video}-${index}`} className="oc-video-list--item oc-media-strip--tile oc-media-strip--item" sx={{ position: 'relative', width: shownWidth, height: shownHeight, flex: '0 0 auto', bgcolor: 'common.black', overflow: 'hidden', borderRadius: '.5rem' }}>
                      {videoStill(video, index)}
                      <CardOptionsMenu ariaLabel={t('edit.videoOptions')} actions={videoMenu(video, index)} />
                    </Box>
                  )
                })}
        </MediaStrip>
      )}
      {showAll && videoUrls.length > 0 && (
        <StripShowAll title={t('videosHeader')} gridMinWidth="260px" sortable={sortableVideos ? { enabled: true, ids: videoUrls, onReorder: reorderVideos } : undefined}>
          {videoUrls.map((video, index) => (
            <li key={sortableVideos ? video : `${video}-${index}`}>
              <Box className="oc-video-list--item oc-carousel--media" sx={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', bgcolor: 'common.black' }}>
                {videoStill(video, index)}
                <CardOptionsMenu reveal ariaLabel={t('edit.videoOptions')} actions={videoMenu(video, index)} />
              </Box>
            </li>
          ))}
        </StripShowAll>
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
      {/* No title (videos have none): named for screen readers only. */}
      <Dialog
        className="oc-video-list--player"
        open={Boolean(activeVideo)}
        onClose={closePlayer}
        maxWidth="md"
        fullWidth
        fullScreen={isPhone}
        {...(transform && { hideBackdrop: true, transitionDuration: 0 })}
        slotProps={{
          paper: { ref: playerRef, 'aria-label': activeVideo ? t('videoFrameTitle', { index: activeVideo.index }) : undefined, sx: isPhone ? { bgcolor: 'common.black' } : undefined },
          transition: { onEntering: () => transform && animatePlayer(true) },
        }}
      >
        <Box ref={playerContentRef} sx={{ display: 'flex', flexDirection: 'column', height: isPhone ? '100%' : 'auto' }}>
          {isPhone ? (
            // Full screen: a back arrow at the start, over black.
            <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, minHeight: 64, flexShrink: 0, color: 'common.white' }}>
              <IconButton className="oc-video-list--player-back" onClick={closePlayer} aria-label={t('back', { ns: 'app' })} sx={{ width: 48, height: 48, color: 'inherit' }}>
                <ArrowBackRounded />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
              <IconButton onClick={closePlayer} aria-label={t('closeVideo')}>
                <CloseRounded />
              </IconButton>
            </Box>
          )}
          {/* The video 16:9, in the middle of the screen on a phone. */}
          <DialogContent sx={{ p: 0, bgcolor: 'common.black', ...(isPhone ? { display: 'flex', alignItems: 'center', flex: 1 } : { aspectRatio: '16 / 9' }) }}>
            {/* Full screen: as wide as fits both ways (in landscape, the
                screen's height under the bar sets it), centred. */}
            {activeVideo && <Box component="iframe" src={autoplayUrl(activeVideo.url)} title={t('videoFrameTitle', { index: activeVideo.index })} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen sx={{ display: 'block', aspectRatio: '16 / 9', border: 0, ...(isPhone ? { width: 'min(100%, calc((100dvh - 64px) * 16 / 9))', height: 'auto', mx: 'auto' } : { width: '100%', height: '100%' }) }} />}
          </DialogContent>
        </Box>
      </Dialog>
    </Box>
  )
}
