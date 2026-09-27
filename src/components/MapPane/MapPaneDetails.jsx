import { useState } from 'react'
import { Link, resolvePath, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Lightbox, { addToolbarButton } from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Download from 'yet-another-react-lightbox/plugins/download'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import { IconButton, styled, useTheme } from '@mui/material'
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import { ArrowBackRounded } from '@mui/icons-material'
import EditMapDialog from '@/components/MapsPicker/EditMapDialog.jsx'
import SistemaModel from '@/models/SistemaModel.js'
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

// Mirrors MediaPaneDetails.jsx: the same Lightbox (with its Zoom plugin,
// replacing the hand-rolled zoom/pan built for the upload dialog - here the
// map is already uploaded, so the library's own viewer is the right tool).
export default function MapPaneDetails({ mapId, maps, sistemaId, returnTo }) {
  const { t } = useTranslation('mediaPane')
  const currentIndex = maps.findIndex((map) => map.id === mapId)
  const currentMap = maps.find((map) => map.id === mapId)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const [editingMap, setEditingMap] = useState(null)

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
  }))

  const isFullscreenEnabled = () => document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? document.mozFullScreenEnabled ?? document.msFullscreenEnabled

  function onView({ index }) {
    const { mapId: nextMapId } = slides[index]
    const from = location.pathname
    const to = resolvePath(`../${nextMapId}`, from).pathname
    if (to !== from) {
      setTimeout(() => navigate(`../${nextMapId}`, { replace: true, relative: 'path', state: location.state }))
    }
  }

  async function handleDelete(map) {
    const remaining = maps.filter((m) => m.id !== map.id)
    await SistemaModel.save(sistemaId, { maps: remaining.map((m) => m.id) })
    if (remaining.length === 0) {
      navigate(returnTo, { replace: true })
    } else {
      navigate(`../${remaining[0].id}`, { replace: true, relative: 'path', state: location.state })
    }
  }

  function Menu({ augment }) {
    augment(({ toolbar, ...rest }) => ({
      toolbar: addToolbarButton(toolbar, 'menu', <MapPaneMenu map={currentMap} onEdit={() => setEditingMap(currentMap)} onDelete={handleDelete} />),
      ...rest,
    }))
  }

  return (
    <Main className="oc-map-pane-details">
      <Lightbox
        index={currentIndex}
        slides={slides}
        fullscreen={{ auto: false }}
        toolbar={{
          buttons: [
            <IconButton
              key="oc-map-pane-details-back-btn"
              aria-label={t('backBtn.ariaLabel')}
              component={Link}
              to={returnTo}
              disableRipple
              sx={{ color: 'var(--yarl__color_button,hsla(0,0%,100%,.8))', marginRight: 'auto' }}
              className="yarl__button"
            >
              {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardIosRounded />}
            </IconButton>,
            'download',
            'fullscreen',
            'menu',
          ],
        }}
        plugins={[Menu, Inline, isFullscreenEnabled() ? Fullscreen : undefined, Download, Zoom].filter(Boolean)}
        carousel={{ padding: 0, spacing: 0, imageFit: 'contain', finite: true }}
        inline={{ style: { width: '100%' } }}
        styles={{ container: { backgroundColor: '#000' }, slide: { justifyContent: 'stretch' } }}
        zoom={{ maxZoomPixelRatio: 5, doubleTapDelay: 300, doubleClickDelay: 300 }}
        render={{
          iconEnterFullscreen: () => <FullscreenRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconExitFullscreen: () => <FullscreenExitRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconDownload: () => <DownloadRoundedIcon sx={{ fontSize: '1.5rem' }} />,
          iconPrev: () => <ArrowBackIosNewRoundedIcon />,
          iconNext: () => <ArrowForwardIosRounded />,
        }}
        noScroll={{ disabled: true }}
        on={{ view: onView }}
      />
      <EditMapDialog map={editingMap} onClose={() => setEditingMap(null)} />
    </Main>
  )
}
