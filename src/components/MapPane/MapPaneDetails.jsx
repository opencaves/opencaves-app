import { useState, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Lightbox, { addToolbarButton } from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Download from 'yet-another-react-lightbox/plugins/download'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import { IconButton, styled, useTheme } from '@mui/material'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useOrientationFullscreen } from '@/hooks/useOrientationFullscreen.js'
import { useGalleryArrowKeys } from '@/hooks/useGalleryArrowKeys.js'
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import MapPaneMenu from './MapPaneMenu.jsx'
import 'yet-another-react-lightbox/styles.css'
import '@/components/MediaPane/lightbox.scss'

const Main = styled('main')(({ theme }) => ({
  flexGrow: 1,
  backgroundColor: '#000',
  position: 'relative',
  zIndex: theme.zIndex.drawer,
  display: 'flex',
}))

// A map's caption (a page's gallery): its name, its details under it.
function MapCaption({ map, details }) {
  return (
    <>
      <span style={{ fontWeight: 500 }}>{map.name}</span>
      {details && (
        <>
          <br />
          {details}
        </>
      )}
    </>
  )
}

// Zoom up to this many screen pixels per pixel of the map's image.
const MAP_MAX_ZOOM_PIXEL_RATIO = 20

// Mirrors MediaPaneDetails.jsx: the same Lightbox (with its Zoom plugin,
// replacing the hand-rolled zoom/pan built for the upload dialog - here the
// map is already uploaded, so the library's own viewer is the right tool).

// The viewer over the whole app window (useOrientationFullscreen's fallback).
const IMMERSIVE_SX = { position: 'fixed', inset: 0, zIndex: 30000, width: 'auto', height: 'auto' }

// mapPath(id): a map's address (the map's viewer by default; a page's gallery
// has its own); alwaysShowBack: the back arrow whatever the screen (no list
// pane beside it); onBack: what it does (a link to returnTo otherwise);
// canEdit: the Edit item in its menu; captioned: "3 / 12" at the top and each
// map's name, year and cartographers under it (no list beside it).
export default function MapPaneDetails({ mapId, maps, sistemaId, returnTo, onTrash, mapPath, alwaysShowBack = false, onBack, canEdit = true, captioned = false }) {
  // The toolbar's back arrow only where nothing else leads back: on phones
  // (the viewer alone) and in full screen - beside the list pane, its
  // header's arrow does.
  const isSmall = useSmall()
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Turning the phone sideways in the installed app goes full screen
  // (or, refused, covers the whole window: immersive); upright leaves it -
  // when the turn entered it.
  const fullscreenRef = useRef(null)
  // The lightbox's controller, for the arrow keys.
  const controllerRef = useRef(null)
  useGalleryArrowKeys(controllerRef)
  const immersive = useOrientationFullscreen(fullscreenRef)
  const showBackArrow = alwaysShowBack || isSmall || isFullscreen || immersive
  const { t } = useTranslation('mediaPane')
  const { t: tMaps } = useTranslation('mapsPicker')
  const currentIndex = maps.findIndex((map) => map.id === mapId)
  const currentMap = maps.find((map) => map.id === mapId)
  const navigate = useNavigate()
  const location = useLocation()
  const { caveId } = useParams()
  const theme = useTheme()

  if (!currentMap) {
    return (
      <Main className="oc-map-pane-details" sx={{ alignItems: 'center', justifyContent: 'center', color: 'common.white' }}>
        <div>{t('details.empty')}</div>
      </Main>
    )
  }

  const slides = maps.map((map) => ({
    mapId: map.id,
    src: map.previewUrl || map.url,
    download: { url: map.url, filename: map.name },
    // Its caption, at the bottom (a title would go in the toolbar, under its
    // buttons): its name, then its year (dates are "2000", "2012-10"...) and
    // who drew it.
    ...(captioned && { description: <MapCaption map={map} details={[map.date?.match(/\d{4}/)?.[0], map.authors?.length > 0 && tMaps('cartography', { names: map.authors.join(', ') })].filter(Boolean).join(' · ')} /> }),
  }))

  const isFullscreenEnabled = () => document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? document.mozFullScreenEnabled ?? document.msFullscreenEnabled

  // The URL follows the map shown - compared by id and written from the
  // cave's: the path may also end in /edit (the Edit dialog, over the viewer),
  // which a path relative to it would get wrong (and close the dialog).
  function onView({ index }) {
    const { mapId: nextMapId } = slides[index]
    if (nextMapId !== mapId) {
      setTimeout(() => navigate(mapPath ? mapPath(nextMapId) : `/map/${caveId}/maps/${nextMapId}`, { replace: true, state: location.state }))
    }
  }

  // `maps` also holds ancestor sistemas' maps (tagged with their own
  // sistemaId), so only the cave's own sistema's maps are written back.
  function Menu({ augment }) {
    augment(({ toolbar, ...rest }) => ({
      toolbar: addToolbarButton(toolbar, 'menu', <MapPaneMenu map={currentMap} onEdit={canEdit ? () => navigate('edit', { state: { ...location.state, editFromViewer: true } }) : undefined} onTrash={onTrash} />),
      ...rest,
    }))
  }

  return (
    <Main className="oc-map-pane-details" sx={immersive ? IMMERSIVE_SX : undefined}>
      <Lightbox
        index={currentIndex}
        slides={slides}
        fullscreen={{ auto: false, ref: fullscreenRef }}
        toolbar={{
          buttons: [
            ...(showBackArrow ? [
              <IconButton
              key="oc-map-pane-details-back-btn"
              aria-label={t('backBtn.ariaLabel')}
              {...(onBack ? { onClick: onBack } : { component: Link, to: returnTo })}
              disableRipple
              sx={{ color: 'var(--yarl__color_button,hsla(0,0%,100%,.8))' }}
              className="yarl__button"
            >
              {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardIosRounded />}
            </IconButton>
            ] : []),
            // Named here, the zoom plugin's buttons go right after the back
            // arrow, on the left (it puts them first otherwise); the spacer
            // sends the others to the right.
            'zoom',
            <span key="oc-map-pane-details-spacer" style={{ marginRight: 'auto' }} />,
            'download',
            'fullscreen',
            // Its menu's place, when it has one (a name with no plugin shows as text).
            ...(canEdit || onTrash ? ['menu'] : []),
          ],
        }}
        plugins={[canEdit || onTrash ? Menu : undefined, Inline, isFullscreenEnabled() ? Fullscreen : undefined, Download, Zoom, captioned && maps.length > 1 && Counter, captioned && Captions].filter(Boolean)}
        counter={{ container: { style: { top: 0, left: '50%', transform: 'translateX(-50%)', lineHeight: '64px', padding: 0, margin: 0 } } }}
        captions={{ showToggle: false, descriptionTextAlign: 'start', descriptionMaxLines: 3 }}
        carousel={{ padding: 0, spacing: 0, imageFit: 'contain', finite: true, imageProps: { crossOrigin: 'anonymous' } }}
        inline={{ style: { width: '100%' } }}
        // Every touch the viewer's (touch-action: none): the Inline plugin forces
        // pan-y, whatever the controller asks, which let the browser take
        // vertical drags - a zoomed-in map couldn't be moved with a finger.
        // Its container reads it from this variable, set after the plugin's.
        styles={{ container: { backgroundColor: '#000', '--yarl__controller_touch_action': 'none' }, slide: { justifyContent: 'stretch' } }}
        // scrollToZoom: the mouse wheel zooms the map instead of scrolling the pane.
        // maxZoomPixelRatio: how far past the image's own pixels it zooms - far,
        // for a map's small print and for vector (SVG) maps, whose stated size
        // is small but which stay sharp at any zoom. pinchZoomV4: a pinch
        // follows the fingers (twice as far apart, twice the zoom); the default
        // multiplied the zoom at every move, so a phone's many small moves
        // zoomed exponentially fast.
        zoom={{ maxZoomPixelRatio: MAP_MAX_ZOOM_PIXEL_RATIO, doubleTapDelay: 300, doubleClickDelay: 300, scrollToZoom: true, pinchZoomV4: true }}
        render={{
          iconEnterFullscreen: () => <FullscreenRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconExitFullscreen: () => <FullscreenExitRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconDownload: () => <DownloadRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconPrev: () => <ArrowBackIosNewRoundedIcon />,
          iconNext: () => <ArrowForwardIosRounded />,
        }}
        noScroll={{ disabled: true }}
        controller={{ ref: controllerRef }}
        on={{ view: onView, enterFullscreen: () => setIsFullscreen(true), exitFullscreen: () => setIsFullscreen(false) }}
      />
    </Main>
  )
}
