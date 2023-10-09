import { useTranslation } from 'react-i18next'
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer'
import { useEffect, useRef, useState } from 'react'
import Lightbox, { addToolbarButton } from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Download from 'yet-another-react-lightbox/plugins/download'
import Share from 'yet-another-react-lightbox/plugins/share'
import { IconButton, styled } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import Picture from '@/components/Picture'
import MediaPaneMenu from './MediaPaneMenu'
import 'yet-another-react-lightbox/styles.css'

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
  const currentMedia = medias.docs.find(media => media.id === mediaId).data()

  const slides = medias.docs.map(doc => {
    const media = doc.data()
    const { url, isPanorama, originalName: filename } = media

    const slide = {
      type: isPanorama ? 'panorama' : 'image',
      download: {
        url,
        filename
      },
      share: {
        url: window.location.href,
        title: t('share.title', { title: document.title }),
        text: t('share.text', { title: document.title })
      }
    }

    if (isPanorama) {
      slide.src = url
    } else {
      slide.sources = media.getSources(['1024', '1536'], { sizes: true })
      // src: url
    }

    return slide
  })

  const [touchAction, setTouchAction] = useState('pan-y')
  const ref = useRef(null)

  const isFullscreenEnabled = () =>
    document.fullscreenEnabled ??
    document.webkitFullscreenEnabled ??
    document.mozFullScreenEnabled ??
    document.msFullscreenEnabled

  function onView({ index }) {
    // console.log('[onView] %s, %o', index, slides[index])
    const { type } = slides[index]
    // setTouchAction(type === 'panorama' ? 'none' : 'pan-y')
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
        styles={{ container: { backgroundColor: '#000' } }}
        controller={{
          ref,
          touchAction
        }}
        render={{
          slide: ({ slide }) => (slide.type === 'panorama' ? <PanoViewer src={slide.src} /> : <Picture sources={slide.sources} width='100%' height='100%' />),
          // buttonPrev: ButtonPrev,
          iconEnterFullscreen: () => <FullscreenRoundedIcon sx={{ fontSize: '1.75rem' }} />,
          iconExitFullscreen: () => <FullscreenExitRoundedIcon sx={{ fontSize: '1.75rem' }} />,
          iconDownload: () => <DownloadRoundedIcon sx={{ fontSize: '1.75rem' }} />,
          iconShare: () => <ShareRoundedIcon sx={{ fontSize: '1.75rem' }} />,
        }}
        on={{
          view: onView
        }}
      />
    </Main>
  )
}

function ButtonPrev() {
  console.log('[buttonPrev] %o', arguments)
  return (
    <IconButton>
      <ArrowBackIosNewRoundedIcon />
    </IconButton>
  )
}

function PanoViewer({ src }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef) {
      console.log('containerRef: %o', containerRef.current)
      function handler(event) {
        console.log('dragging: %o', event.bubbles)
        event.stopPropagation()
      }

      containerRef.current.addEventListener('pointermove', handler)

      return () => {
        containerRef?.current?.removeEventListener('pointermove', handler)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%'
      }}
    >
      <ReactPhotoSphereViewer src={src} height='100%' width='100%' />
    </div>
  )
}