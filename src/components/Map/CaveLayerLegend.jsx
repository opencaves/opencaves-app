import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ExpandLessRounded, ExpandMoreRounded } from '@mui/icons-material'
import { CAVE_LAYER } from '@/config/map.js'

// What the cave layer's marks mean (CaveLayer's styles), under the layer
// button, while the passages are shown. On phones a chip that opens it,
// fading with the other map controls as the result pane's sheet opens
// (ResultPaneSm's --oc-map-controls-* variables).
export default function CaveLayerLegend({ isLarge }) {
  const { t } = useTranslation('map', { keyPrefix: 'caveLayer.legend' })
  const theme = useTheme()
  const { visible, colorBySistema } = useSelector((state) => state.caveLayer)
  const [open, setOpen] = useState(isLarge)

  if (!visible) return null

  // One plain example colour: a system's (any) when coloured by system, the
  // layer's single colour otherwise. Water has its own colour.
  const lineColor = colorBySistema ? '#76378a' : theme.palette.primary.light
  const swatch = { width: 28, height: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const items = [
    { key: 'walls', mark: <Box sx={{ width: 26, height: 3, borderRadius: 2, bgcolor: lineColor }} /> },
    { key: 'water', mark: <Box sx={{ width: 26, height: 12, borderRadius: 1, bgcolor: CAVE_LAYER.WATER_COLOR, opacity: CAVE_LAYER.WATER_OPACITY }} /> },
    { key: 'details', mark: <Box sx={{ width: 26, height: 0, borderTop: '1px solid', borderColor: lineColor, opacity: 0.7 }} /> },
    { key: 'entrance', mark: <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'info.main', border: '1px solid #fff' }} /> },
    { key: 'depth', mark: <Typography component="span" sx={{ fontSize: 11, fontWeight: 500 }}>12 m</Typography> },
    { key: 'placeName', mark: <Typography component="span" sx={{ fontSize: 11, fontStyle: 'italic' }}>Aa</Typography> },
    { key: 'flow', mark: <Typography component="span" sx={{ fontSize: 15, lineHeight: 1, color: 'info.dark' }}>➜</Typography> },
  ]

  return (
    <Paper
      className="oc-cave-layer-legend"
      component="aside"
      aria-label={t('title')}
      elevation={2}
      sx={{
        position: 'absolute',
        // Under the layer button (CaveLayerButton's place in routes/Map.jsx:
        // under the account button on desktop, the search bar on phones).
        top: isLarge ? 'calc(1rem + 56px + 0.75rem + 56px + 0.75rem)' : 'calc(48px + 1.5rem + 48px + 0.75rem)',
        right: isLarge ? '1rem' : '0.5rem',
        borderRadius: 4,
        bgcolor: (th) => th.sys.color.surfaceContainerHigh,
        maxWidth: 'calc(100vw - 16px)',
        ...(!isLarge && { opacity: 'var(--oc-map-controls-opacity, 1)', visibility: 'var(--oc-map-controls-visibility, visible)', transition: 'opacity 150ms ease, visibility 150ms ease' }),
      }}
    >
      <ButtonBase onClick={() => setOpen((o) => !o)} aria-expanded={open} sx={{ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: 4 }}>
        <Typography variant="subtitle2" component="h2">
          {t('title')}
        </Typography>
        {open ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
      </ButtonBase>
      {open && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, px: 1.5, pb: 1.5, pt: 0, display: 'grid', gap: 0.75 }}>
          {items.map(({ key, mark }) => (
            <Box component="li" key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={swatch} aria-hidden="true">
                {mark}
              </Box>
              <Typography variant="body2" sx={{ fontSize: 13 }}>
                {t(key)}
              </Typography>
            </Box>
          ))}
          <Typography component="li" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {colorBySistema ? t('bySystem') : t('single')}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
