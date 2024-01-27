import { useRef, useState } from 'react'
import { Link, resolvePath, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Lightbox, { addToolbarButton } from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Download from 'yet-another-react-lightbox/plugins/download'
import Share from 'yet-another-react-lightbox/plugins/share'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import { IconButton, styled, useTheme } from '@mui/material'
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import MediaViewer from '@/components/MediaViewer/MediaViewer'
import MediaPaneMenu from './MediaPaneMenu'
import 'yet-another-react-lightbox/styles.css'
import './lightbox.scss'
import { ArrowBackRounded } from '@mui/icons-material'

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

export default function MediaPaneDetails({ mediaId, medias }) {
  const { t } = useTranslation('mediaPane')
  const currentIndex = medias.docs.findIndex(media => media.id === mediaId)
  const currentMedia = medias.docs.find(media => media.id === mediaId)?.data()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()

  const [touchAction, setTouchAction] = useState('none')
  const ref = useRef(null)

  if (!currentMedia) {
    return (
      <Main
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

  const slides = medias.docs.map(doc => {
    const media = doc.data()
    const { id, url, usePanoramaViewer, originalName: filename } = media
    const slide = {
      mediaId: id,
      type: usePanoramaViewer ? 'panorama' : 'image',
      download: {
        url,
        filename
      },
      ratio: media.width / media.height,
      share: {
        url: window.location.href,
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
  })

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
      toolbar: addToolbarButton(toolbar, 'menu', <MediaPaneMenu mediaAsset={currentMedia} />),
      ...restProps,
    }))
  }

  return (
    <Main>
      <Lightbox
        index={currentIndex}
        slides={slides}
        fullscreen={{ auto: false }}
        toolbar={{
          buttons: [
            <IconButton
              key='oc-media-pane-details-back-btn'
              aria-label={t('backBtn.ariaLabel')}
              component={Link}
              to='..'
              disableRipple
              sx={{
                color: 'var(--yarl__color_button,hsla(0,0%,100%,.8))',
                marginRight: 'auto'
              }}
              className='yarl__button'
            >
              {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardIosRounded />}
            </IconButton>,
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
          finite: true
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
          touchAction: 'none'
        }}
        render={{
          slide: ({ slide }) => (<MediaViewer media={slide} />),
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
          view: onView
        }}
      />
    </Main>
  )
}