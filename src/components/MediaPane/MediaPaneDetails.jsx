import { useMemo, useRef, useState } from 'react'
import { Link, resolvePath, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Lightbox, { addToolbarButton } from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Download from 'yet-another-react-lightbox/plugins/download'
import Share from 'yet-another-react-lightbox/plugins/share'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import { IconButton, styled, useTheme } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useOrientationFullscreen } from '@/hooks/useOrientationFullscreen.js'
import { useGalleryArrowKeys } from '@/hooks/useGalleryArrowKeys.js'
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import MediaViewer from '@/components/MediaViewer/MediaViewer.jsx'
import MediaPaneMenu from './MediaPaneMenu.jsx'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import 'yet-another-react-lightbox/styles.css'
import './lightbox.scss'

const Main = styled('main')(
  ({ theme, open }) => {

    return ({
      flexGrow: 1,
      backgroundColor: '#000',
      position: 'relative',
      zIndex: theme.zIndex.drawer,
      display: 'flex'
    })
  },
)

// The viewer over the whole app window (useOrientationFullscreen's fallback).
const IMMERSIVE_SX = { position: 'fixed', inset: 0, zIndex: 30000, width: 'auto', height: 'auto' }

export default function MediaPaneDetails({ mediaId, medias, onBeforeDelete }) {
  // The toolbar's back arrow only where nothing else leads back: on phones
  // (the viewer alone) and in full screen - beside the list pane, its
  // header's arrow does.
  const isSmall = useSmall()
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Turning the phone sideways in the installed app goes full screen
  // (or, refused, covers the whole window: immersive); upright leaves it -
  // when the turn entered it.
  const fullscreenRef = useRef(null)
  const immersive = useOrientationFullscreen(fullscreenRef)
  const showBackArrow = isSmall || isFullscreen || immersive
  const { t } = useTranslation('mediaPane')
  const currentIndex = medias.docs.findIndex(media => media.id === mediaId)
  const currentMedia = medias.docs.find(media => media.id === mediaId)?.data()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()

  const [touchAction, setTouchAction] = useState('none')
  const [swipeLocked, setSwipeLocked] = useState(false)
  const ref = useRef(null)
  useGalleryArrowKeys(ref)

  // Built once per set of photos: the lightbox resets itself (and rebuilds
  // every slide - the photos flickered) whenever it gets a new slides array,
  // which each re-render made, e.g. the URL change after moving to a photo.
  // So each slide's share link is its own photo's, not the address at the time.
  const mediasPath = location.pathname.replace(/[^/]+$/, '')
  const slides = useMemo(() => medias.docs.map(doc => {
    const media = doc.data()
    const { id, url, usePanoramaViewer, mediaType } = media
    // Not the uploaded file's name: it isn't public (cavesAssetsPrivate).
    const filename = `opencaves-${id}.${(mediaType || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg')}`
    const slide = {
      mediaId: id,
      type: usePanoramaViewer ? 'panorama' : 'image',
      download: {
        url,
        filename
      },
      ratio: media.width / media.height,
      share: {
        url: `${window.location.origin}${mediasPath}${id}`,
        title: t('share.title', { title: document.title }),
        text: t('share.text', { title: document.title })
      }
    }

    if (usePanoramaViewer) {
      slide.src = url
    } else {
      slide.sources = media.getSources(['1024', '1536', '4k'], { sizes: true })
    }

    return slide
  }), [medias, mediasPath, t])

  if (!currentMedia) {
    return (
      <Main
        className="oc-media-pane-details"
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          color: theme => theme.palette.common.white
        }}
      >
        <div>{t('details.empty')}</div>
      </Main>
    )
  }


  const isFullscreenEnabled = () =>
    document.fullscreenEnabled ??
    document.webkitFullscreenEnabled ??
    document.mozFullScreenEnabled ??
    document.msFullscreenEnabled

  function onView({ index }) {
    const { mediaId, type } = slides[index]
    const from = location.pathname
    const to = resolvePath(`../${mediaId}`, from).pathname
    // setTouchAction(type === 'panorama' ? 'none' : 'pan-y')
    if (to !== from) {
      setTimeout(() => {
        navigate(`../${mediaId}`, { replace: true, relative: 'path' })
      })
    }
  }

  function Menu({ augment }) {
    augment(({ toolbar, ...restProps }) => ({
      toolbar: addToolbarButton(toolbar, 'menu', <MediaPaneMenu mediaAsset={currentMedia} onBeforeDelete={(mediaAsset) => onBeforeDelete?.(mediaAsset, true)} />),
      ...restProps,
    }))
  }

  return (
    <Main className="oc-media-pane-details" sx={immersive ? IMMERSIVE_SX : undefined}>
      <Lightbox
        index={currentIndex}
        slides={slides}
        fullscreen={{ auto: false, ref: fullscreenRef }}
        toolbar={{
          buttons: [
            ...(showBackArrow ? [
              <IconButton
              key='oc-media-pane-details-back-btn'
              aria-label={t('backBtn.ariaLabel')}
              component={Link}
              to='..'
              disableRipple
              sx={{
                color: 'var(--yarl__color_button,hsla(0,0%,100%,.8))',
                // Doubled class: the lightbox's own .yarl__button { margin: 0 }
                // has the same weight, and whichever stylesheet came last won -
                // the arrow sat on the right, by the other buttons.
                '&&': { marginRight: 'auto' }
              }}
              className='yarl__button'
            >
              {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardIosRounded />}
            </IconButton>
            ] : []),
            'share',
            'download',
            'fullscreen',
            'menu'
          ]
        }}
        plugins={[Menu, Inline, isFullscreenEnabled() ? Fullscreen : undefined, Download, Share]}
        carousel={{
          padding: 0,
          spacing: 0,
          imageFit: 'contain',
          finite: true,
          // CORS mode, matching <Picture> (see storage.cors.json).
          imageProps: { crossOrigin: 'anonymous' }
        }}
        inline={{
          style: {
            width: '100%'
          },
        }}
        styles={{
          container: { backgroundColor: '#000' },
          slide: { justifyContent: 'stretch' }
        }}
        controller={{
          ref,
          touchAction: 'none',
          // No slide change while the photo is zoomed in or pinched (MediaViewer).
          disableSwipeNavigation: swipeLocked
        }}
        render={{
          slide: ({ slide }) => (<MediaViewer media={slide} onSwipeLock={setSwipeLocked} />),
          iconEnterFullscreen: () => <FullscreenRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconExitFullscreen: () => <FullscreenExitRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconDownload: () => <DownloadRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconShare: () => <ShareRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconPrev: () => <ArrowBackIosNewRoundedIcon />,
          iconNext: () => <ArrowForwardIosRounded />
        }}
        noScroll={{
          disabled: true
        }}
        on={{
          view: onView, enterFullscreen: () => setIsFullscreen(true), exitFullscreen: () => setIsFullscreen(false)
        }}
      />
    </Main>
  )
}