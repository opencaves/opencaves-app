import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Chip, Dialog, IconButton, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded'
import Map, { Layer, Source } from 'react-map-gl/mapbox'
import { MAP_PROPS } from '@/config/map.js'
import CaveLayer, { caveTileRequest } from '@/components/Map/CaveLayer.jsx'

const KEY_STEP = 0.05

// The extent of the scan's corners, [[west, south], [east, north]].
function boundsOf(corners) {
  const lngs = corners.map(([lng]) => lng)
  const lats = corners.map(([, lat]) => lat)
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

// A map's original next to its drawing, both on the ground: two maps kept on
// the same view, the drawing's on top and cut at a divider dragged sideways -
// the original on its left, the drawing on its right. The original is the
// image the drawing was traced from, at the corners the tracing placed it
// (maps.json's "scan", georef_scans.py), so the two line up.
export default function MapCompareViewer({ map, open, onClose }) {
  const { t } = useTranslation('mapLayersAdmin', { keyPrefix: 'viewer' })
  const [split, setSplit] = useState(0.5)
  const containerRef = useRef(null)
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

  function moveDivider(event) {
    const rect = containerRef.current.getBoundingClientRect()
    setSplit(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)))
  }

  function onDividerKey(event) {
    const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key]
    if (step) {
      event.preventDefault()
      setSplit((value) => Math.min(1, Math.max(0, value + step)))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setSplit(event.key === 'Home' ? 0 : 1)
    }
  }

  const mapProps = {
    ...MAP_PROPS,
    mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
    initialViewState: { bounds: boundsOf(map.scan), fitBoundsOptions: { padding: 24 } },
    transformRequest: caveTileRequest,
    style: { position: 'absolute', inset: 0 },
  }
  // Exact, for a smooth slide; rounded only for what screen readers say.
  const position = `${split * 100}%`
  const percent = Math.round(split * 100)

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

      <Box ref={containerRef} className="oc-map-compare-viewer--maps" sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <Map ref={originalRef} {...mapProps} {...follow(drawingRef)}>
          <Source id="oc-scan" type="image" url={`/tiles/caves/scans/${map.id}.webp`} coordinates={map.scan}>
            <Layer id="oc-scan" type="raster" paint={{ 'raster-fade-duration': 0 }} />
          </Source>
        </Map>
        {/* On top, cut at the divider: the cut also stops its pointer events,
            so the original on the left can be moved too. */}
        <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${position})` }}>
          <Map ref={drawingRef} {...mapProps} {...follow(originalRef)}>
            <CaveLayer mapId={map.id} />
          </Map>
        </Box>

        <Chip className="oc-map-compare-viewer--label" label={t('original')} size="small" sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'background.paper', pointerEvents: 'none', opacity: split < 0.15 ? 0 : 1 }} />
        <Chip className="oc-map-compare-viewer--label" label={t('drawing')} size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'background.paper', pointerEvents: 'none', opacity: split > 0.85 ? 0 : 1 }} />

        {/* The divider: dragged by its whole height (a wide, invisible grip
            around the line), or moved with the arrow keys. */}
        <Box
          className="oc-map-compare-viewer--divider"
          role="slider"
          tabIndex={0}
          aria-label={t('divider')}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={t('dividerValue', { original: percent, drawing: 100 - percent })}
          onKeyDown={onDividerKey}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            moveDivider(event)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(event)
          }}
          sx={(theme) => ({
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: position,
            width: 32,
            ml: '-16px',
            cursor: 'ew-resize',
            touchAction: 'none',
            outline: 'none',
            '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, ml: '-1px', bgcolor: '#fff', boxShadow: '0 0 4px rgba(0, 0, 0, 0.5)' },
            '&:focus-visible .oc-map-compare-viewer--grip': { outline: `2px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
          })}
        >
          <Box
            className="oc-map-compare-viewer--grip"
            sx={{ position: 'absolute', top: '50%', left: '50%', width: 32, height: 48, mt: '-24px', ml: '-16px', borderRadius: 4, bgcolor: '#fff', boxShadow: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}
          >
            <DragIndicatorRounded />
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
