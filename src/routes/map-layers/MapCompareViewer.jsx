import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Dialog, IconButton, Paper, Slider, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import Map, { Layer, Source } from 'react-map-gl/mapbox'
import { MAP_PROPS } from '@/config/map.js'
import CaveLayer, { caveTileRequest } from '@/components/Map/CaveLayer.jsx'

// The extent of the scan's corners, [[west, south], [east, north]].
function boundsOf(corners) {
  const lngs = corners.map(([lng]) => lng)
  const lats = corners.map(([, lat]) => lat)
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

// A map's original and its drawing, both on the ground, cross-faded with a
// slider: two maps kept on the same view, the drawing's on top at the
// slider's opacity - the original at one end, the drawing at the other. The
// satellite imagery is the same in both, so only the original and the drawing
// fade into each other. The original is the image the drawing was traced from,
// at the corners the tracing placed it (maps.json's "scan", georef_scans.py),
// so the two line up.
export default function MapCompareViewer({ map, open, onClose }) {
  const { t } = useTranslation('mapLayersAdmin', { keyPrefix: 'viewer' })
  // The drawing's share: 0, the original alone; 1, the drawing alone.
  const [blend, setBlend] = useState(0.5)
  const originalRef = useRef(null)
  const drawingRef = useRef(null)
  // Set while one map is put on the other's view: that move isn't copied back.
  const syncing = useRef(false)

  if (!map?.scan) return null

  // Whichever map moves (drag, wheel, pinch, keys, its own easing), the other
  // takes its view.
  function follow(to) {
    return {
      onMove: (event) => {
        if (syncing.current) return
        const source = event.target
        syncing.current = true
        to.current?.getMap().jumpTo({ center: source.getCenter(), zoom: source.getZoom(), bearing: source.getBearing(), pitch: source.getPitch() })
        syncing.current = false
      },
    }
  }

  const mapProps = {
    ...MAP_PROPS,
    mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
    initialViewState: { bounds: boundsOf(map.scan), fitBoundsOptions: { padding: 24 } },
    transformRequest: caveTileRequest,
    style: { position: 'absolute', inset: 0 },
  }

  return (
    <Dialog className="oc-map-compare-viewer" open={open} onClose={onClose} fullScreen>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tooltip title={t('back')}>
          <IconButton aria-label={t('back')} onClick={onClose}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h2">
            {map.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {t('hint')}
          </Typography>
        </Box>
      </Box>

      <Box className="oc-map-compare-viewer--maps" sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <Map ref={originalRef} {...mapProps} {...follow(drawingRef)}>
          <Source id="oc-scan" type="image" url={`/tiles/caves/scans/${map.id}.webp`} coordinates={map.scan}>
            <Layer id="oc-scan" type="raster" paint={{ 'raster-fade-duration': 0 }} />
          </Source>
        </Map>
        {/* On top, at the slider's opacity: it takes the pointer, and the
            original's map follows it. */}
        <Box sx={{ position: 'absolute', inset: 0, opacity: blend }}>
          <Map ref={drawingRef} {...mapProps} {...follow(originalRef)}>
            <CaveLayer mapId={map.id} />
          </Map>
        </Box>

        <Paper
          className="oc-map-compare-viewer--blend"
          elevation={3}
          sx={{ position: 'absolute', left: '50%', bottom: 'calc(24px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', width: 'min(440px, calc(100% - 32px))', display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1, borderRadius: 7 }}
        >
          <Typography variant="body2" sx={{ fontWeight: blend < 0.5 ? 600 : 400 }}>
            {t('original')}
          </Typography>
          <Slider
            value={blend}
            min={0}
            max={1}
            step={0.01}
            shiftStep={0.1}
            onChange={(_event, value) => setBlend(value)}
            aria-label={t('blend')}
            getAriaValueText={(value) => t('blendValue', { drawing: Math.round(value * 100) })}
            sx={{ flex: 1, mx: 1 }}
          />
          <Typography variant="body2" sx={{ fontWeight: blend > 0.5 ? 600 : 400 }}>
            {t('drawing')}
          </Typography>
        </Paper>
      </Box>
    </Dialog>
  )
}
